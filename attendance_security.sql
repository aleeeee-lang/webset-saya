-- ============================================================
-- ATTENDANCE SECURITY: school area (GPS) + fingerprint check-in
-- ============================================================
-- Run in Supabase -> SQL Editor, AFTER attendance_rules.sql. Safe to re-run.
--
-- PART A - LOCATION
-- The admin sets the school's point (latitude/longitude) and how far from it
-- a check-in may be (radius in metres), then turns the check on.
-- When it is on, a student's own "Hadir" check-in must send the phone's GPS
-- position, and the SERVER measures the distance (so changing the app on the
-- phone doesn't get around it). Izin / Sakit don't need a location.
-- Position, accuracy and distance are saved with the check-in so the admin
-- can look at odd ones later.
-- While the check is off (the default), nothing changes.
--
-- PART B - FINGERPRINT
-- A student can check in with the phone's fingerprint instead of the face
-- photo. The phone checks the finger (it never leaves the phone); the
-- "webauthn" Edge Function checks the phone's signed answer and hands out a
-- one-time ticket. The check-in below accepts that ticket once, within
-- 2 minutes, for that student only. One phone per student; the admin resets it.

-- 1) the school's point ----------------------------------------------------
create table if not exists public.school_location (
    id text primary key default 'default',
    enabled boolean not null default false,
    lat double precision,
    lng double precision,
    radius_m integer not null default 80 check (radius_m between 30 and 5000),
    label text,
    updated_by uuid references profiles(id) on delete set null,
    updated_at timestamptz not null default now(),
    constraint school_location_point check (not enabled or (lat between -90 and 90 and lng between -180 and 180))
);
alter table public.school_location enable row level security;
drop policy if exists school_location_select on public.school_location;
create policy school_location_select on public.school_location for select to authenticated using (true);
drop policy if exists school_location_insert on public.school_location;
create policy school_location_insert on public.school_location for insert to authenticated with check (public.is_admin());
drop policy if exists school_location_update on public.school_location;
create policy school_location_update on public.school_location for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- 2) where each check-in was sent from --------------------------------------
alter table public.attendance add column if not exists lat double precision;
alter table public.attendance add column if not exists lng double precision;
alter table public.attendance add column if not exists accuracy_m real;
alter table public.attendance add column if not exists distance_m integer;

-- distance in metres between two points (haversine)
create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision,
                                                 lat2 double precision, lng2 double precision)
returns double precision
language sql immutable as $$
    select 2 * 6371000 * asin(sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- 2b) fingerprint: the registered phone, the open challenges, the tickets ---
create table if not exists public.webauthn_credentials (
    user_id uuid primary key references profiles(id) on delete cascade,   -- one phone per student
    credential_id text not null unique,
    public_key text not null,
    counter bigint not null default 0,
    transports text[],
    device_label text,
    created_at timestamptz not null default now(),
    last_used_at timestamptz
);
alter table public.webauthn_credentials enable row level security;
drop policy if exists webauthn_cred_select on public.webauthn_credentials;
create policy webauthn_cred_select on public.webauthn_credentials for select to authenticated
    using (user_id = auth.uid() or public.is_admin());
drop policy if exists webauthn_cred_delete on public.webauthn_credentials;
create policy webauthn_cred_delete on public.webauthn_credentials for delete to authenticated
    using (public.is_admin());                       -- "reset fingerprint" (e.g. a new phone)
-- no insert/update policies: only the Edge Function (service role) writes here

create table if not exists public.webauthn_challenges (
    user_id uuid primary key references profiles(id) on delete cascade,
    kind text not null check (kind in ('register', 'auth')),
    challenge text not null,
    created_at timestamptz not null default now()
);
alter table public.webauthn_challenges enable row level security;   -- Edge Function only

create table if not exists public.fp_tickets (
    ticket uuid primary key default gen_random_uuid(),
    user_id uuid not null references profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    used_at timestamptz
);
create index if not exists fp_tickets_user_idx on public.fp_tickets (user_id, created_at);
alter table public.fp_tickets enable row level security;            -- Edge Function + the check below only

alter table public.attendance add column if not exists method text;      -- 'face' or 'fingerprint'
alter table public.attendance add column if not exists fp_ticket uuid;   -- only while saving; always emptied

-- 3) the server check of a student's own check-in, now with location + fingerprint -----
-- (same as attendance_rules.sql, plus part "location" at the end)
create or replace function public.guard_self_attendance()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
    p record;
    s record;
    loc record;
    dist double precision;
    now_local timestamp := now() at time zone 'Asia/Jakarta';
    t time := (now() at time zone 'Asia/Jakarta')::time;
begin
    if auth.uid() is null or is_admin() then return new; end if;
    -- a teacher filling in for a student is checked by the policies, not here
    if new.user_id is distinct from auth.uid() then return new; end if;

    -- date, time and weekday always come from the server clock
    new.date := now_local::date;
    new.time := date_trunc('minute', t)::time;
    new.day  := trim(to_char(now_local, 'FMDay'));

    select name, class into p from profiles where id = auth.uid();
    new.name  := p.name;
    new.class := p.class;

    -- one check-in per day (the lock stops a double tap from slipping through)
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text || new.date::text));
    if exists (select 1 from attendance where user_id = auth.uid() and date = new.date) then
        raise exception 'ATT_ALREADY' using hint = 'You already checked in today';
    end if;

    if not public.att_day_open(p.class, new.date) then
        raise exception 'ATT_DAY_CLOSED' using hint = 'Check-in is closed today';
    end if;

    select * into s from attendance_schedules where class = p.class;
    if found then
        if t < s.start_time then
            raise exception 'ATT_NOT_OPEN_YET' using hint = 'Check-in is not open yet';
        end if;
        if t > s.end_time then
            if s.late_mode = 'late' and s.late_end_time is not null and t <= s.late_end_time then
                if coalesce(new.reason, '') not like '[Telat]%' then
                    new.reason := trim('[Telat] ' || coalesce(new.reason, ''));
                end if;
            else
                raise exception 'ATT_CLOSED' using hint = 'Check-in is closed for today';
            end if;
        end if;
    end if;

    -- location: "Hadir" must be inside the school area (when the admin turned it on)
    new.distance_m := null;
    select * into loc from school_location where id = 'default';
    if new.status = 'Hadir' and found and loc.enabled and loc.lat is not null and loc.lng is not null then
        if new.lat is null or new.lng is null
           or new.lat not between -90 and 90 or new.lng not between -180 and 180 then
            raise exception 'ATT_NO_LOCATION' using hint = 'Turn on location to check in';
        end if;
        if new.accuracy_m is null or new.accuracy_m > 300 then
            raise exception 'ATT_LOCATION_WEAK' using hint = 'Location is not accurate enough';
        end if;
        dist := public.geo_distance_m(loc.lat, loc.lng, new.lat, new.lng);
        new.distance_m := round(dist)::int;
        -- a little room for GPS error, at most 50 m
        if dist > loc.radius_m + least(new.accuracy_m, 50) then
            raise exception 'ATT_TOO_FAR' using hint = 'You are outside the school area';
        end if;
    elsif new.status is distinct from 'Hadir' then
        -- Izin / Sakit: don't keep a location
        new.lat := null; new.lng := null; new.accuracy_m := null;
    end if;

    -- fingerprint: the one-time ticket from the "webauthn" Edge Function
    if new.fp_ticket is not null then
        update fp_tickets set used_at = now()
        where ticket = new.fp_ticket and user_id = auth.uid() and used_at is null
          and created_at > now() - interval '2 minutes';
        if not found then
            raise exception 'ATT_FP_INVALID' using hint = 'Fingerprint check expired, scan again';
        end if;
        -- the photo taken automatically after the scan, in the student's own folder
        if new.photo_url is null or split_part(new.photo_url, '/', 1) <> auth.uid()::text then
            raise exception 'ATT_FP_PHOTO' using hint = 'A photo is needed with fingerprint check-in';
        end if;
        new.method := 'fingerprint';
    else
        new.method := 'face';
    end if;
    new.fp_ticket := null;

    return new;
end $$;
-- (the trigger guard_self_attendance already exists and keeps using this function)

-- old tickets are useless after 2 minutes; keep the table small
delete from public.fp_tickets where created_at < now() - interval '1 day';
