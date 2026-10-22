-- ============================================================
-- AUTO QR WITH "ABSEN SUDAH DIBUKA"
-- ============================================================
-- Run in Supabase -> SQL Editor (after attendance_qr.sql and attendance_open_exact.sql).
-- Safe to re-run.
--
-- When a class's check-in opens, every student who hasn't checked in gets their own QR
-- together with the "Absen sudah dibuka" notification (one notification, not two).
--   * the QR works until the check-in closes for that class, then it's gone;
--   * same rules as a QR from the teacher: only for that student, once, only inside the
--     school area, photo taken automatically;
--   * only made when the school point is set (otherwise a QR could never be used);
--   * a student who checks in any other way (fingerprint, or a teacher records it) loses
--     their open QRs straight away;
--   * teachers can still send QRs by hand from Kirim QR absen.

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
    where p.role = 'murid' and p.class = p_class and coalesce(p.status, 'active') <> 'inactive'
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

    -- the notification (students who turned "Absen dibuka" off still get the QR in the app)
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

-- checked in some other way: the open QRs of that student go away
create or replace function public.att_close_open_qr()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    update qr_passes set expires_at = now()
    where user_id = new.user_id and used_at is null and expires_at > now();
    return null;
end $$;
drop trigger if exists att_close_open_qr on public.attendance;
create trigger att_close_open_qr after insert on public.attendance
    for each row execute function public.att_close_open_qr();
