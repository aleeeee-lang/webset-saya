-- ============================================================
-- "ABSEN SUDAH DIBUKA" EXACTLY ON TIME
-- ============================================================
-- Run in Supabase -> SQL Editor (after attendance_open_push.sql). Safe to re-run.
--
-- For every class in Jadwal absen, the database keeps one pg_cron alarm at that class's
-- check-in start time (school time zone). When it rings, students of the class who
-- haven't checked in get the notification right away (push_queue is sent instantly).
--   * the alarms follow the schedule: saving / changing / deleting a class's check-in
--     time, or changing the school time zone, moves them automatically;
--   * holidays and days that aren't school days for the class are skipped (att_day_open);
--   * one notification per student per day (att_open_push_log, shared with the
--     5-minute reminder run, which stays as a backup);
--   * students who turned "Absen dibuka" off in Notifikasi don't get it.

-- send the notification for one class (called by the alarm)
create or replace function public.att_open_send(p_class text)
returns int
language plpgsql security definer set search_path = public as $$
declare
    tz text := public.school_tz();
    d date := (now() at time zone tz)::date;
    s record;
    close_t time;
    n int;
begin
    if not public.att_day_open(p_class, d) then return 0; end if;
    select * into s from attendance_schedules where class = p_class;
    if not found then return 0; end if;
    close_t := case when s.late_mode = 'late' and s.late_end_time is not null then s.late_end_time else s.end_time end;

    with who as (
        select p.id from profiles p
        where p.role = 'murid' and p.class = p_class and coalesce(p.status, 'active') <> 'inactive'
          and not exists (select 1 from attendance a where a.user_id = p.id and a.date = d)
          and not exists (select 1 from att_open_push_log l where l.class = p_class and l.day = d and l.user_id = p.id)
          and not exists (select 1 from notif_prefs np where np.user_id = p.id and np.att_open = false)
    ),
    logged as (
        insert into att_open_push_log (class, day, user_id)
        select p_class, d, id from who
        on conflict do nothing
        returning user_id
    )
    insert into push_queue (user_id, title, body, url, tag)
    select user_id, '🔔 Absen sudah dibuka',
           'Absen dibuka' || coalesce(' sampai ' || to_char(close_t, 'HH24.MI'), '') || '. Tempel sidik jari atau pakai QR dari guru.',
           'attendance.html', 'attopen-' || d
    from logged;
    get diagnostics n = row_count;
    return n;
end $$;
revoke execute on function public.att_open_send(text) from public, anon, authenticated;

-- (re)build every alarm from the current schedules (pg_cron runs in UTC)
create or replace function public.att_open_resync()
returns void
language plpgsql security definer set search_path = public as $$
declare j record; s record; utc time;
begin
    for j in select jobname from cron.job where jobname like 'att-open-%' loop
        perform cron.unschedule(j.jobname);
    end loop;
    for s in select class, start_time from attendance_schedules where class is not null and start_time is not null loop
        utc := ((date '2001-01-01' + s.start_time) at time zone public.school_tz()) at time zone 'UTC';
        perform cron.schedule('att-open-' || md5(s.class),
                              extract(minute from utc)::int || ' ' || extract(hour from utc)::int || ' * * *',
                              format('select public.att_open_send(%L)', s.class));
    end loop;
end $$;
revoke execute on function public.att_open_resync() from public, anon, authenticated;

create or replace function public.att_open_resync_trg()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    perform public.att_open_resync();
    return null;
end $$;

drop trigger if exists att_open_alarms on public.attendance_schedules;
create trigger att_open_alarms after insert or update of class, start_time or delete on public.attendance_schedules
    for each statement execute function public.att_open_resync_trg();

drop trigger if exists att_open_alarms_tz on public.school_location;
create trigger att_open_alarms_tz after update of timezone on public.school_location
    for each statement execute function public.att_open_resync_trg();

-- set the alarms for the schedules that already exist
select public.att_open_resync();
