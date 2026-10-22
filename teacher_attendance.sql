-- ============================================================
-- TEACHERS CHECK IN TOO (like students)
-- ============================================================
-- Run in Supabase -> SQL Editor (after attendance_qr.sql, attendance_open_exact.sql and
-- attendance_open_qr.sql). Safe to re-run.
--
-- Teachers check in on the same page as students (fingerprint or QR, photo, school area,
-- check-in hours, one check-in a day). Their check-ins are kept under the group "Guru"
-- (attendance.class = 'Guru'), so they never mix with the numbers of the class a teacher leads.
--   * check-in hours for teachers: the "Guru" row in Jadwal absen (admin-schedule.html);
--   * "Absen sudah dibuka" + an automatic QR at that time, like the students;
--   * the admin can send a QR to "Guru" from Kirim QR absen (teachers can't);
--   * the admin sees them in Kelola absensi -> filter "Guru";
--   * admins and parents can't check themselves in (an admin's own row would skip every check);
--   * a teacher can't change their own check-in afterwards (only the admin can);
--   * "Guru" is a reserved name: don't use it for a class of students.

-- 1) the checks on every self check-in -------------------------------------------------
create or replace function public.guard_self_attendance()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
    p record;
    s record;
    loc record;
    dist double precision;
    ckey text;
    now_local timestamp := now() at time zone public.school_tz();
    t time := (now() at time zone public.school_tz())::time;
begin
    if auth.uid() is null then return new; end if;
    if is_admin() then
        -- an admin records attendance for others, never for themselves
        if new.user_id = auth.uid() then
            raise exception 'ATT_NOT_FOR_ROLE' using hint = 'Admins do not check in';
        end if;
        return new;
    end if;
    -- a teacher filling in for a student is checked by the policies, not here
    if new.user_id is distinct from auth.uid() then return new; end if;

    select name, class, role into p from profiles where id = auth.uid();
    if p.role is distinct from 'murid' and p.role is distinct from 'guru' then
        raise exception 'ATT_NOT_FOR_ROLE' using hint = 'Only students and teachers check in';
    end if;
    -- teachers are one group of their own, whatever class they lead
    ckey := case when p.role = 'guru' then 'Guru' else p.class end;

    -- date, time and weekday always come from the server clock (school time zone)
    new.date := now_local::date;
    new.time := date_trunc('minute', t)::time;
    new.day  := trim(to_char(now_local, 'FMDay'));
    new.name  := p.name;
    new.class := ckey;

    -- one check-in per day (the lock stops a double tap from slipping through)
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text || new.date::text));
    if exists (select 1 from attendance where user_id = auth.uid() and date = new.date) then
        raise exception 'ATT_ALREADY' using hint = 'You already checked in today';
    end if;

    if not public.att_day_open(ckey, new.date) then
        raise exception 'ATT_DAY_CLOSED' using hint = 'Check-in is closed today';
    end if;

    select * into s from attendance_schedules where class = ckey;
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
        -- the photo taken automatically after the scan, in the person's own folder
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

-- 2) teachers only fill in / read / fix the attendance of STUDENTS of their class -------
--    (before, a teacher's own row counted as "a person of my class", so they could edit it)
drop policy if exists attendance_insert_teacher on public.attendance;
create policy attendance_insert_teacher on public.attendance for insert to authenticated
    with check (exists (select 1 from profiles p
                        where p.id = attendance.user_id and p.role = 'murid' and is_teacher_of_class(p.class)));
drop policy if exists attendance_select_teacher on public.attendance;
create policy attendance_select_teacher on public.attendance for select to authenticated
    using (exists (select 1 from profiles p
                   where p.id = attendance.user_id and p.role = 'murid' and is_teacher_of_class(p.class)));
drop policy if exists attendance_update_teacher on public.attendance;
create policy attendance_update_teacher on public.attendance for update to authenticated
    using (exists (select 1 from profiles p
                   where p.id = attendance.user_id and p.role = 'murid' and is_teacher_of_class(p.class)));

-- 3) the class ranking (Juara) only counts students ------------------------------------
create or replace function public.champ_classes(d_from date, d_to date)
returns table (class text, hadir integer, total integer, students integer)
language sql stable security definer set search_path = public as $$
    select a.class, count(*) filter (where a.status = 'Hadir')::int, count(*)::int, count(distinct a.user_id)::int
    from attendance a join profiles p on p.id = a.user_id and p.role = 'murid'
    where a.date between d_from and d_to and a.class is not null and a.class <> 'Guru' and auth.uid() is not null
    group by a.class;
$$;

-- 4) "Absen sudah dibuka" + QR: the group "Guru" means every active teacher --------------
create or replace function public.att_open_send(p_class text)
returns int
language plpgsql security definer set search_path = public as $$
declare
    tz text := public.school_tz();
    d date := (now() at time zone tz)::date;
    s record;
    close_t time;
    exp timestamptz;
    with_qr boolean;
    b uuid := gen_random_uuid();
    n int;
begin
    if not public.att_day_open(p_class, d) then return 0; end if;
    select * into s from attendance_schedules where class = p_class;
    if not found then return 0; end if;
    close_t := case when s.late_mode = 'late' and s.late_end_time is not null then s.late_end_time else s.end_time end;
    exp := case when close_t is not null and (d + close_t) at time zone tz > now()
                then (d + close_t) at time zone tz else now() + interval '2 hours' end;
    with_qr := exists (select 1 from school_location where id = 'default' and lat is not null and lng is not null);

    create temp table if not exists _att_open_who (id uuid) on commit drop;
    truncate _att_open_who;
    insert into _att_open_who
    select p.id from profiles p
    where (case when p_class = 'Guru' then p.role = 'guru' else p.role = 'murid' and p.class = p_class end)
      and coalesce(p.status, 'active') <> 'inactive'
      and not exists (select 1 from attendance a where a.user_id = p.id and a.date = d)
      and not exists (select 1 from att_open_push_log l where l.class = p_class and l.day = d and l.user_id = p.id);

    insert into att_open_push_log (class, day, user_id)
    select p_class, d, id from _att_open_who on conflict do nothing;

    if with_qr then
        delete from qr_passes where expires_at < now() - interval '2 days';
        insert into qr_passes (batch_id, user_id, class, code, sent_by, sent_by_name, expires_at)
        select b, w.id, p_class, replace(gen_random_uuid()::text, '-', ''), null, 'Jadwal absen', exp
        from _att_open_who w;
    end if;

    -- the notification (people who turned "Absen dibuka" off still get the QR in the app)
    insert into push_queue (user_id, title, body, url, tag)
    select w.id, '🔔 Absen sudah dibuka',
           'Absen dibuka' || coalesce(' sampai ' || to_char(close_t, 'HH24.MI'), '') ||
           case when with_qr then '. Tempel sidik jari atau buka QR absenmu.' else '. Tempel sidik jari untuk absen.' end,
           case when with_qr then 'attendance.html#qr' else 'attendance.html' end,
           'attopen-' || d
    from _att_open_who w
    where not exists (select 1 from notif_prefs np where np.user_id = w.id and np.att_open = false);
    get diagnostics n = row_count;
    return n;
end $$;
revoke execute on function public.att_open_send(text) from public, anon, authenticated;

-- 5) Kirim QR absen: the admin can send to "Guru" (every active teacher) -----------------
create or replace function public.qr_send(target_class text, minutes int)
returns json
language plpgsql security definer set search_path = public as $$
declare
    b uuid := gen_random_uuid();
    exp timestamptz := now() + make_interval(mins => greatest(5, least(240, coalesce(minutes, 15))));
    who text := (select name from profiles where id = auth.uid());
    to_teachers boolean := target_class = 'Guru';
    n int;
begin
    if auth.uid() is null or target_class is null or btrim(target_class) = ''
       or not (public.is_admin() or (not to_teachers and public.is_teaching_class(target_class))) then
        raise exception 'NOT_ALLOWED';
    end if;
    delete from qr_passes where expires_at < now() - interval '2 days';
    -- a new send replaces the QRs of this group that are still open
    delete from qr_passes where class = target_class and used_at is null and expires_at > now();
    insert into qr_passes (batch_id, user_id, class, code, sent_by, sent_by_name, expires_at)
    select b, p.id, target_class, replace(gen_random_uuid()::text, '-', ''), auth.uid(), who, exp
    from profiles p
    where (case when to_teachers then p.role = 'guru' else p.role = 'murid' and p.class = target_class end)
      and coalesce(p.status, 'active') <> 'inactive';
    get diagnostics n = row_count;
    insert into push_queue (user_id, title, body, url, tag)
    select q.user_id, '📲 QR absen dari ' || coalesce(who, 'guru'),
           'Buka untuk absen. Berlaku sampai ' || to_char(exp at time zone public.school_tz(), 'HH24.MI') || ', hanya di area sekolah.',
           'attendance.html#qr', 'qr-' || b
    from qr_passes q where q.batch_id = b;
    return json_build_object('batch_id', b, 'count', n, 'expires_at', exp);
end $$;
grant execute on function public.qr_send(text, int) to authenticated;
