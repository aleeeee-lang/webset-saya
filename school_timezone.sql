-- ============================================================
-- SCHOOL TIME ZONE (WIB / WITA / WIT)
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- Until now every rule used WIB (Asia/Jakarta). The admin can now pick
-- the school's own zone in Kelola Jadwal; check-in times, dates, the
-- [Telat] window, deleting approved leave and the cash dues date all
-- follow it. Default stays WIB, so nothing changes until an admin picks.

-- 1) the setting, kept with the school location row -----------------------
alter table public.school_location add column if not exists timezone text not null default 'Asia/Jakarta';
alter table public.school_location drop constraint if exists school_location_tz;
alter table public.school_location add constraint school_location_tz
    check (timezone in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'));

-- the school's zone (WIB when nothing is saved yet)
create or replace function public.school_tz()
returns text
language sql stable security definer set search_path = public as $$
    select coalesce((select timezone from school_location where id = 'default'), 'Asia/Jakarta')
$$;

-- today's date at the school
create or replace function public.school_today()
returns date
language sql stable security definer set search_path = public as $$
    select (now() at time zone public.school_tz())::date
$$;

-- the server clock for the app: it shows the time the server will use
create or replace function public.server_clock()
returns json
language sql stable security definer set search_path = public as $$
    select json_build_object('now', now(), 'tz', public.school_tz())
$$;
grant execute on function public.school_tz(), public.school_today(), public.server_clock() to authenticated;

-- 2) check-in rules use the school zone -----------------------------------
create or replace function public.guard_self_attendance()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
    p record;
    s record;
    loc record;
    dist double precision;
    now_local timestamp := now() at time zone public.school_tz();
    t time := (now() at time zone public.school_tz())::time;
begin
    if auth.uid() is null or is_admin() then return new; end if;
    -- a teacher filling in for a student is checked by the policies, not here
    if new.user_id is distinct from auth.uid() then return new; end if;

    -- date, time and weekday always come from the server clock (school time zone)
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

-- 3) approved leave can be deleted the day after it ends (was WIT by mistake)
drop policy if exists leave_requests_delete_own on public.leave_requests;
create policy leave_requests_delete_own on public.leave_requests for delete to authenticated
    using (user_id = auth.uid() and (status in ('pending', 'rejected')
           or (status = 'approved' and coalesce(end_date, start_date) < public.school_today())));

-- 4) dates filled in automatically use the school day (not the UTC day) ---
alter table public.class_cash_entries alter column entry_date set default public.school_today();
alter table public.achievements alter column achieved_on set default public.school_today();
alter table public.attendance_period_settings alter column period_start set default public.school_today();
alter table public.student_activities alter column date set default public.school_today();

-- 5) cash dues accepted from a transfer get the school date ----------------
do $do$
declare d text;
begin
    select pg_get_functiondef('public.review_cash_proof(uuid, boolean, text)'::regprocedure) into d;
    if position('''Asia/Jakarta''' in d) > 0 then
        execute replace(d, '''Asia/Jakarta''', 'public.school_tz()');
    end if;
end $do$;
