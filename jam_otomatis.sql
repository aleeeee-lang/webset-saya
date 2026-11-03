-- =====================================================================
-- Jam absen otomatis (2026-11)
-- Kalau admin BELUM mengatur jam absen sebuah kelas (attendance_schedules),
-- jam absennya mengikuti jadwal pelajaran hari itu (class_schedules):
--   absen masuk  : 30 menit sebelum pelajaran pertama s/d 15 menit setelah mulai
--   absen pulang : dari selesainya pelajaran terakhir, selama 10 menit
--   hari sekolah : hari yang ada pelajarannya
-- Kelas yang jamnya sudah diatur admin tetap memakai jam dari admin.
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- =====================================================================

-- 1) Jam absen sebuah kelas pada satu tanggal: dari admin, atau otomatis dari pelajaran
create or replace function public.att_window(p_class text, p_date date)
returns table (start_time time, end_time time, late_mode text, late_end_time time,
               checkout_start time, checkout_end time, auto boolean)
language plpgsql stable security definer set search_path = public as $$
declare s record; f time; l time;
begin
    select * into s from attendance_schedules a where a.class = p_class;
    if found then
        return query select s.start_time, s.end_time, s.late_mode, s.late_end_time,
                            s.checkout_start, s.checkout_end, false;
        return;
    end if;
    select min(c.start_time), max(coalesce(c.end_time, c.start_time)) into f, l
    from class_schedules c
    where c.class = p_class and c.day = extract(isodow from p_date)::int;
    if f is null then return; end if;   -- no lesson that day: nothing to open
    return query select (f - interval '30 minutes')::time, (f + interval '15 minutes')::time,
                        'block'::text, null::time,
                        l, (l + interval '10 minutes')::time, true;
end $$;

-- 2) Hari sekolah: kelas tanpa jam dari admin tapi punya jadwal pelajaran -> hanya hari yang ada pelajarannya
create or replace function public.att_day_open(p_class text, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
    with ag as (
        select bool_or(coalesce(attendance_open, type <> 'holiday') = false) as closed,
               bool_or(attendance_open = true and (classes is null or classes @> to_jsonb(p_class))) as forced_open
        from holidays where date = p_date
    )
    select case
        when (select closed from ag) then false
        when (select forced_open from ag) then true
        -- tanggal merah nasional
        when exists (select 1 from national_holidays n where n.date = p_date and n.kind = 'libur') then false
        -- libur tiap minggu seluruh sekolah (misal Sabtu & Minggu)
        when coalesce((select weekly_off from attendance_period_settings where id = 'global'), '[]'::jsonb)
             @> to_jsonb(extract(isodow from p_date)::int) then false
        else coalesce(
            (select s.active_days @> to_jsonb(extract(isodow from p_date)::int)
             from attendance_schedules s where s.class = p_class),
            -- jam belum diatur admin: hari yang ada pelajarannya (kelas tanpa jadwal pelajaran: setiap hari)
            case when exists (select 1 from class_schedules c where c.class = p_class)
                 then exists (select 1 from class_schedules c where c.class = p_class
                              and c.day = extract(isodow from p_date)::int)
                 else true end)
    end;
$$;

-- 3) Penjaga absen masuk: pakai att_window (jam admin atau otomatis)
create or replace function public.guard_self_attendance()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
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

    -- the admin's hours, or (not set) the ones that follow today's lessons
    select * into s from public.att_window(ckey, new.date);
    if found and s.start_time is not null then
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
end $function$;

-- 4) Absen pulang: pakai att_window
create or replace function public.att_checkout(p_photo text, p_fp_ticket uuid default null::uuid,
    p_lat double precision default null::double precision, p_lng double precision default null::double precision,
    p_accuracy double precision default null::double precision, p_reason text default null::text)
returns json language plpgsql security definer set search_path to 'public', 'storage' as $function$
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

    -- the admin's hours, or (not set) the end of today's last lesson
    select * into s from public.att_window(ckey, d);
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
end $function$;

-- 5) Notifikasi "Absen sudah dibuka": pakai att_window
create or replace function public.att_open_send(p_class text)
returns integer language plpgsql security definer set search_path to 'public' as $function$
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
    select * into s from public.att_window(p_class, d);
    if not found or s.start_time is null then return 0; end if;
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
    select w.id, 'Absen sudah dibuka',
           'Absen dibuka' || coalesce(' sampai ' || to_char(close_t, 'HH24.MI'), '') ||
           case when with_qr then '. Tempel sidik jari atau buka QR absenmu.' else '. Tempel sidik jari untuk absen.' end,
           case when with_qr then 'attendance.html#qr' else 'attendance.html' end,
           'attopen-' || d
    from _att_open_who w
    where not exists (select 1 from notif_prefs np where np.user_id = w.id and np.att_open = false);
    get diagnostics n = row_count;
    return n;
end $function$;

-- 6) Notifikasi "Absen pulang dibuka": pakai att_window
create or replace function public.att_checkout_open_send(p_class text)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
    tz text := public.school_tz();
    d date := (now() at time zone tz)::date;
    s record; n int;
begin
    if not public.att_day_open(p_class, d) then return 0; end if;
    select * into s from public.att_window(p_class, d);
    if not found or s.checkout_start is null then return 0; end if;
    insert into push_queue (user_id, title, body, url, tag)
    select a.user_id, 'Absen pulang dibuka',
           'Absen pulang' || coalesce(' sampai ' || to_char(s.checkout_end, 'HH24.MI'), '') || '. Tempel sidik jari sebelum pulang.',
           'attendance.html', 'attout-' || d
    from attendance a
    where a.date = d and a.status = 'Hadir' and a.checkout_time is null
      and (case when p_class = 'Guru' then exists (select 1 from profiles g where g.id = a.user_id and g.role = 'guru')
                else a.class = p_class end)
      and not exists (select 1 from notif_prefs np where np.user_id = a.user_id and np.att_open = false);
    get diagnostics n = row_count;
    return n;
end $function$;

-- 7) Kelas dengan jam otomatis: tiap 5 menit dicek, notifikasi dikirim sekali saat absen dibuka
create or replace function public.att_auto_tick()
returns void language plpgsql security definer set search_path = public as $$
declare
    tz text := public.school_tz();
    d date := (now() at time zone tz)::date;
    t time := (now() at time zone tz)::time;
    c record; w record;
begin
    for c in select distinct cs.class from class_schedules cs
             where cs.class is not null
               and not exists (select 1 from attendance_schedules a where a.class = cs.class) loop
        select * into w from public.att_window(c.class, d);
        if not found then continue; end if;
        if w.start_time is not null and t >= w.start_time and t < w.start_time + interval '5 minutes' then
            perform public.att_open_send(c.class);
        end if;
        if w.checkout_start is not null and t >= w.checkout_start and t < w.checkout_start + interval '5 minutes' then
            perform public.att_checkout_open_send(c.class);
        end if;
    end loop;
end $$;

do $$
begin
    perform cron.unschedule('att-auto-tick') where exists (select 1 from cron.job where jobname = 'att-auto-tick');
    perform cron.schedule('att-auto-tick', '*/5 * * * *', 'select public.att_auto_tick()');
end $$;

grant execute on function public.att_window(text, date) to authenticated;
