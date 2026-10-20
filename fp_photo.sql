-- ============================================================
-- FINGERPRINT CHECK-IN NEEDS THE AUTOMATIC PHOTO
-- ============================================================
-- Run in Supabase -> SQL Editor, AFTER attendance_security.sql. Safe to re-run.
--
-- Right after a fingerprint match the app takes one front-camera photo by
-- itself and sends it with the check-in. This makes the server refuse a
-- fingerprint check-in without that photo (code ATT_FP_PHOTO), so the photo
-- can't be skipped. Everything else in the check stays the same.

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
