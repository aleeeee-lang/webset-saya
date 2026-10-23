-- ============================================================
-- ABSEN PULANG (check-out)
-- ============================================================
-- Run in Supabase -> SQL Editor (after teacher_attendance.sql). Safe to re-run.
--
-- After checking in "Hadir", a student (or teacher) checks out when going home, on the
-- same page, with the same proof: fingerprint (or camera on a phone without one), a fresh
-- front-camera photo, and the school area when the location check is on.
--   * hours per class (and for "Guru") in Jadwal absen: checkout_start - checkout_end;
--     no checkout_start = check-out is off for that class (nothing changes for it);
--   * before checkout_start = "pulang awal": allowed, but a reason is required and it is marked;
--   * after checkout_end the check-out is closed (the day shows "tidak absen pulang");
--   * once a day, only after a "Hadir" check-in;
--   * "Absen pulang dibuka" notification at checkout_start for those who are still in.
-- The check-out is written by att_checkout() only (students can't edit their own row).

alter table public.attendance add column if not exists checkout_time time;
alter table public.attendance add column if not exists checkout_photo_url text;
alter table public.attendance add column if not exists checkout_method text;
alter table public.attendance add column if not exists checkout_lat double precision;
alter table public.attendance add column if not exists checkout_lng double precision;
alter table public.attendance add column if not exists checkout_accuracy_m real;
alter table public.attendance add column if not exists checkout_distance_m integer;
alter table public.attendance add column if not exists checkout_reason text;

alter table public.attendance_schedules add column if not exists checkout_start time;
alter table public.attendance_schedules add column if not exists checkout_end time;

-- the check-out itself
create or replace function public.att_checkout(p_photo text, p_fp_ticket uuid default null,
    p_lat double precision default null, p_lng double precision default null,
    p_accuracy double precision default null, p_reason text default null)
returns json
language plpgsql security definer set search_path = public, storage as $$
declare
    uid uuid := auth.uid();
    tz text := public.school_tz();
    now_local timestamp := now() at time zone tz;
    d date := (now() at time zone tz)::date;
    t time := date_trunc('minute', (now() at time zone tz)::time)::time;
    p record; a record; s record; loc record;
    ckey text; early boolean; dist double precision; v_method text := 'face';
    why text := nullif(btrim(coalesce(p_reason, '')), '');
begin
    if uid is null then raise exception 'NOT_ALLOWED'; end if;
    select role, class into p from profiles where id = uid;
    if p.role is distinct from 'murid' and p.role is distinct from 'guru' then
        raise exception 'ATT_NOT_FOR_ROLE' using hint = 'Only students and teachers check out';
    end if;
    ckey := case when p.role = 'guru' then 'Guru' else p.class end;

    select * into a from attendance where user_id = uid and date = d for update;
    if not found then raise exception 'ATT_CO_NO_CHECKIN' using hint = 'Check in first'; end if;
    if a.status is distinct from 'Hadir' then raise exception 'ATT_CO_NOT_PRESENT' using hint = 'Only after a Hadir check-in'; end if;
    if a.checkout_time is not null then raise exception 'ATT_CO_ALREADY' using hint = 'You already checked out today'; end if;

    select * into s from attendance_schedules where class = ckey;
    if not found or s.checkout_start is null then raise exception 'ATT_CO_OFF' using hint = 'Check-out is not used for this class'; end if;
    if s.checkout_end is not null and t > s.checkout_end then raise exception 'ATT_CO_CLOSED' using hint = 'Check-out is closed for today'; end if;
    early := t < s.checkout_start;
    if early and why is null then raise exception 'ATT_CO_REASON' using hint = 'Going home early needs a reason'; end if;

    -- the photo: taken just now, in the person's own folder, never used before
    if p_photo is null or p_photo !~ ('^' || uid::text || '/[0-9]+\.jpg$') then
        raise exception 'ATT_PHOTO_NEEDED' using hint = 'Take a photo (or scan your fingerprint) first';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'attendance-photos' and o.name = p_photo
                   and o.created_at > now() - interval '10 minutes') then
        raise exception 'ATT_PHOTO_NEEDED' using hint = 'The photo is missing or too old, take it again';
    end if;
    if exists (select 1 from attendance x where x.photo_url = p_photo or x.checkout_photo_url = p_photo) then
        raise exception 'ATT_PHOTO_NEEDED' using hint = 'This photo was already used';
    end if;

    -- fingerprint: the one-time ticket from the "webauthn" Edge Function
    if p_fp_ticket is not null then
        update fp_tickets set used_at = now()
        where ticket = p_fp_ticket and user_id = uid and used_at is null and created_at > now() - interval '2 minutes';
        if not found then raise exception 'ATT_FP_INVALID' using hint = 'Fingerprint check expired, scan again'; end if;
        v_method := 'fingerprint';
    end if;

    -- location: inside the school area (when the admin turned it on)
    select * into loc from school_location where id = 'default';
    if found and loc.enabled and loc.lat is not null and loc.lng is not null then
        if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
            raise exception 'ATT_NO_LOCATION' using hint = 'Turn on location to check out';
        end if;
        if p_accuracy is null or p_accuracy > 300 then
            raise exception 'ATT_LOCATION_WEAK' using hint = 'Location is not accurate enough';
        end if;
        dist := public.geo_distance_m(loc.lat, loc.lng, p_lat, p_lng);
        if dist > loc.radius_m + least(p_accuracy, 50) then
            raise exception 'ATT_TOO_FAR' using hint = 'You are outside the school area';
        end if;
    end if;

    update attendance set
        checkout_time = t,
        checkout_photo_url = p_photo,
        checkout_method = v_method,
        checkout_lat = p_lat, checkout_lng = p_lng, checkout_accuracy_m = p_accuracy,
        checkout_distance_m = case when dist is null then null else round(dist)::int end,
        checkout_reason = case when early then '[Pulang awal] ' || why else why end
    where id = a.id;

    return json_build_object('time', to_char(t, 'HH24.MI'), 'early', early);
end $$;
revoke execute on function public.att_checkout(text, uuid, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.att_checkout(text, uuid, double precision, double precision, double precision, text) to authenticated;

-- "Absen pulang dibuka": for those who checked in Hadir and haven't checked out yet
create or replace function public.att_checkout_open_send(p_class text)
returns int
language plpgsql security definer set search_path = public as $$
declare
    tz text := public.school_tz();
    d date := (now() at time zone tz)::date;
    s record; n int;
begin
    if not public.att_day_open(p_class, d) then return 0; end if;
    select * into s from attendance_schedules where class = p_class;
    if not found or s.checkout_start is null then return 0; end if;
    insert into push_queue (user_id, title, body, url, tag)
    select a.user_id, '🏠 Absen pulang dibuka',
           'Absen pulang' || coalesce(' sampai ' || to_char(s.checkout_end, 'HH24.MI'), '') || '. Tempel sidik jari sebelum pulang.',
           'attendance.html', 'attout-' || d
    from attendance a
    where a.date = d and a.status = 'Hadir' and a.checkout_time is null
      and (case when p_class = 'Guru' then exists (select 1 from profiles g where g.id = a.user_id and g.role = 'guru')
                else a.class = p_class end)
      and not exists (select 1 from notif_prefs np where np.user_id = a.user_id and np.att_open = false);
    get diagnostics n = row_count;
    return n;
end $$;
revoke execute on function public.att_checkout_open_send(text) from public, anon, authenticated;

-- the alarms (pg_cron, UTC): check-in opens + check-out opens, rebuilt from the schedules
create or replace function public.att_open_resync()
returns void
language plpgsql security definer set search_path = public as $$
declare j record; s record; utc time;
begin
    for j in select jobname from cron.job where jobname like 'att-open-%' or jobname like 'att-out-%' loop
        perform cron.unschedule(j.jobname);
    end loop;
    for s in select class, start_time, checkout_start from attendance_schedules where class is not null loop
        if s.start_time is not null then
            utc := ((date '2001-01-01' + s.start_time) at time zone public.school_tz()) at time zone 'UTC';
            perform cron.schedule('att-open-' || md5(s.class),
                                  extract(minute from utc)::int || ' ' || extract(hour from utc)::int || ' * * *',
                                  format('select public.att_open_send(%L)', s.class));
        end if;
        if s.checkout_start is not null then
            utc := ((date '2001-01-01' + s.checkout_start) at time zone public.school_tz()) at time zone 'UTC';
            perform cron.schedule('att-out-' || md5(s.class),
                                  extract(minute from utc)::int || ' ' || extract(hour from utc)::int || ' * * *',
                                  format('select public.att_checkout_open_send(%L)', s.class));
        end if;
    end loop;
end $$;
revoke execute on function public.att_open_resync() from public, anon, authenticated;

drop trigger if exists att_open_alarms on public.attendance_schedules;
create trigger att_open_alarms after insert or update of class, start_time, checkout_start or delete on public.attendance_schedules
    for each statement execute function public.att_open_resync_trg();

select public.att_open_resync();
