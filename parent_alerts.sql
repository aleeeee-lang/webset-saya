-- parent_alerts.sql
-- Parents only hear about what matters (2026 redesign). Each alert lands in their
-- Notifikasi page (kept in the database, so it is there even if the app was closed)
-- and, when they turned notifications on, on their phone:
--   * not_in        the child has not checked in after check-in closed, and has no leave request
--   * absent        the child was recorded Alpa
--   * spp_unpaid    this month's SPP is still unpaid on the 10th (once a month)
--   * spp_rejected  the SPP transfer proof was rejected
--   * announce      an announcement for everyone / the child's class / the child
-- Daily news (check-in time, grades, ...) stays on the parent home page, without alerts.
-- Each alert is sent once (one per child, kind and day / month / item).
-- Safe to run more than once. Needs push_events.sql (push_queue) and pg_cron.

create table if not exists public.parent_alerts (
    id bigserial primary key,
    parent_id uuid not null references public.profiles(id) on delete cascade,
    student_id uuid references public.profiles(id) on delete cascade,
    kind text not null,
    ref text not null,
    title text not null,
    body text not null default '',
    url text not null default 'parent.html',
    created_at timestamptz not null default now(),
    read_at timestamptz
);
create unique index if not exists parent_alerts_once on public.parent_alerts (parent_id, kind, ref);
create index if not exists parent_alerts_recent on public.parent_alerts (parent_id, created_at desc);

alter table public.parent_alerts enable row level security;
drop policy if exists parent_alerts_select_own on public.parent_alerts;
create policy parent_alerts_select_own on public.parent_alerts for select to authenticated using (parent_id = auth.uid());
drop policy if exists parent_alerts_update_own on public.parent_alerts;
create policy parent_alerts_update_own on public.parent_alerts for update to authenticated using (parent_id = auth.uid()) with check (parent_id = auth.uid());
drop policy if exists parent_alerts_delete_own on public.parent_alerts;
create policy parent_alerts_delete_own on public.parent_alerts for delete to authenticated using (parent_id = auth.uid());
-- parents may only mark an alert read; nobody inserts from the app
revoke insert, update on public.parent_alerts from anon, authenticated;
grant select, delete on public.parent_alerts to authenticated;
grant update (read_at) on public.parent_alerts to authenticated;

-- one alert to every parent of a student (or every parent at all when student is null);
-- p_push = false when the phone notification already goes out another way
create or replace function public.parent_alert(p_student uuid, p_kind text, p_ref text, p_title text, p_body text,
                                               p_url text default 'parent.html', p_push boolean default true,
                                               p_parents uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    n int := 0;
    -- one alert per child: two children absent on the same day are two alerts
    v_ref text := coalesce(p_student::text || ':', '') || p_ref;
begin
    with targets as (
        select distinct pl.parent_id from parent_links pl
        where p_student is not null and pl.student_id = p_student
        union
        select unnest(p_parents) where p_parents is not null
    ), ins as (
        insert into parent_alerts (parent_id, student_id, kind, ref, title, body, url)
        select t.parent_id, p_student, p_kind, v_ref, p_title, coalesce(p_body, ''), coalesce(p_url, 'parent.html')
        from targets t join profiles pp on pp.id = t.parent_id and pp.role = 'orangtua'
        on conflict (parent_id, kind, ref) do nothing
        returning parent_id
    ), pushed as (
        insert into push_queue (user_id, title, body, url, tag)
        select i.parent_id, p_title, left(coalesce(p_body, ''), 180), 'inbox.html', 'parent-' || p_kind || '-' || md5(v_ref)
        from ins i
        where p_push and exists (select 1 from push_subscriptions ps where ps.user_id = i.parent_id)
        returning 1
    )
    select count(*) into n from ins;
    return n;
exception when others then
    raise warning 'parent_alert: %', sqlerrm;
    return 0;
end $$;
revoke all on function public.parent_alert(uuid, text, text, text, text, text, boolean, uuid[]) from public, anon, authenticated;

create or replace function public.parent_first_name(n text) returns text
language sql immutable set search_path = public as $$ select coalesce(nullif(split_part(trim(coalesce(n, '')), ' ', 1), ''), 'Anak') $$;

-- recorded Alpa (by a teacher / the admin / the end-of-day rule)
create or replace function public.queue_parent_absent() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    who text;
    today date := (now() at time zone public.school_tz())::date;
begin
    if new.status is distinct from 'Alpa' then return new; end if;
    if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
    if not exists (select 1 from profiles where id = new.user_id and role = 'murid') then return new; end if;
    who := public.parent_first_name(coalesce((select name from profiles where id = new.user_id), new.name));
    perform public.parent_alert(new.user_id, 'absent', new.date::text,
        case when new.date = today then who || ' tidak masuk hari ini' else who || ' tercatat Alpa · ' || to_char(new.date, 'DD/MM') end,
        'Dicatat Alpa oleh sekolah' || coalesce(' — ' || nullif(trim(new.reason), ''), '') || '. Hubungi wali kelas bila ada kekeliruan.');
    return new;
exception when others then
    raise warning 'queue_parent_absent: %', sqlerrm;
    return new;
end $$;
drop trigger if exists queue_parent_absent on public.attendance;
create trigger queue_parent_absent after insert or update of status on public.attendance
    for each row execute function public.queue_parent_absent();

-- SPP proof rejected
create or replace function public.queue_parent_spp_rejected() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    mon text[] := array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    m int;
begin
    if new.status is distinct from 'rejected' or old.status is not distinct from 'rejected' then return new; end if;
    m := nullif(split_part(coalesce(new.period, ''), '-', 2), '')::int;
    perform public.parent_alert(new.user_id, 'spp_rejected', new.id::text || '-' || coalesce(extract(epoch from new.reviewed_at)::bigint::text, '0'),
        'Bukti SPP ' || coalesce(mon[m], new.period) || ' ditolak',
        coalesce(nullif(trim(new.reject_reason), ''), 'Mohon kirim ulang bukti pembayaran') || '.');
    return new;
exception when others then
    raise warning 'queue_parent_spp_rejected: %', sqlerrm;
    return new;
end $$;
drop trigger if exists queue_parent_spp_rejected on public.spp_payments;
create trigger queue_parent_spp_rejected after update of status on public.spp_payments
    for each row execute function public.queue_parent_spp_rejected();

-- announcements: everyone -> all parents (their phone already gets it from queue_broadcast_push);
-- a class / one student -> those students' parents (with a phone notification)
create or replace function public.queue_parent_announce() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
    if new.target_type = 'all' then
        perform public.parent_alert(null, 'announce', new.id::text, 'Pengumuman sekolah', left(coalesce(new.message, ''), 300), 'parent.html', false,
            (select array_agg(id) from profiles where role = 'orangtua'));
    elsif new.target_type = 'class' then
        -- one alert per parent, even with two children in that class
        perform public.parent_alert(null, 'announce', new.id::text, 'Pengumuman kelas ' || coalesce(new.target_value, ''), left(coalesce(new.message, ''), 300), 'parent.html', true,
            (select array_agg(distinct pl.parent_id) from parent_links pl join profiles st on st.id = pl.student_id
             where st.role = 'murid' and st.class = new.target_value));
    elsif new.target_type = 'student' then
        for s in select id, name from profiles where role = 'murid' and id::text = new.target_value loop
            perform public.parent_alert(s.id, 'announce', new.id::text,
                'Pengumuman untuk ' || public.parent_first_name(s.name), left(coalesce(new.message, ''), 300));
        end loop;
    end if;
    return new;
exception when others then
    raise warning 'queue_parent_announce: %', sqlerrm;
    return new;
end $$;
drop trigger if exists queue_parent_announce on public.broadcasts;
create trigger queue_parent_announce after insert on public.broadcasts
    for each row execute function public.queue_parent_announce();

-- every 10 minutes: "not checked in" after check-in closed, and unpaid SPP from the 10th
create or replace function public.parent_daily_alerts() returns int
language plpgsql security definer set search_path = public as $$
declare
    tz text := public.school_tz();
    nowl timestamp := now() at time zone tz;
    d date := (now() at time zone tz)::date;
    t time := (now() at time zone tz)::time;
    mon text[] := array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    per text := to_char(nowl, 'YYYY-MM');
    amt numeric;
    r record;
    n int := 0;
begin
    -- 1) not checked in, check-in closed, no leave request, a school day for the class
    for r in
        select s.id, s.name, sc.class,
               coalesce(case when sc.late_mode = 'late' then sc.late_end_time end, sc.end_time) as closes
        from attendance_schedules sc
        join profiles s on s.class = sc.class and s.role = 'murid' and coalesce(s.status, 'active') <> 'inactive'
        where sc.class <> 'Guru'
          and coalesce(case when sc.late_mode = 'late' then sc.late_end_time end, sc.end_time) is not null
          and t > coalesce(case when sc.late_mode = 'late' then sc.late_end_time end, sc.end_time)
          and t < time '21:00'
          and public.att_day_open(sc.class, d)
          and (s.created_at at time zone tz)::date < d
          and not exists (select 1 from attendance a where a.user_id = s.id and a.date = d)
          and not exists (select 1 from leave_requests lr where lr.user_id = s.id and lr.status in ('pending', 'approved')
                          and lr.start_date <= d and coalesce(lr.end_date, lr.start_date) >= d)
          and exists (select 1 from parent_links pl where pl.student_id = s.id)
    loop
        n := n + public.parent_alert(r.id, 'not_in', d::text,
            public.parent_first_name(r.name) || ' belum absen hari ini',
            'Absen masuk sudah ditutup ' || to_char(r.closes, 'HH24.MI') || ' dan belum ada izin.');
    end loop;

    -- 2) SPP of this month still unpaid on the 10th or later (once a month)
    if extract(day from nowl) >= 10 then
        select amount into amt from spp_settings where id = 'global';
        if coalesce(amt, 0) > 0 then
            for r in
                select s.id, s.name, coalesce(s.spp_custom_amount, amt) as due
                from profiles s
                where s.role = 'murid' and coalesce(s.status, 'active') <> 'inactive'
                  and (s.created_at at time zone tz)::date < date_trunc('month', nowl)::date
                  and coalesce(s.spp_custom_amount, amt) > 0
                  and not exists (select 1 from spp_payments p where p.user_id = s.id and p.period = per and p.status in ('pending', 'approved'))
                  and exists (select 1 from parent_links pl where pl.student_id = s.id)
            loop
                n := n + public.parent_alert(r.id, 'spp_unpaid', per,
                    'SPP ' || mon[extract(month from nowl)::int] || ' ' || public.parent_first_name(r.name) || ' belum dibayar',
                    'Rp' || replace(to_char(r.due, 'FM999G999G999'), ',', '.') || ' · bayar lalu kirim bukti dari akun anak.');
            end loop;
        end if;
    end if;
    return n;
end $$;
revoke all on function public.parent_daily_alerts() from public, anon, authenticated;

do $$
begin
    if exists (select 1 from cron.job where jobname = 'attendreem-parent-alerts') then
        perform cron.unschedule('attendreem-parent-alerts');
    end if;
    perform cron.schedule('attendreem-parent-alerts', '*/10 * * * *', 'select public.parent_daily_alerts()');
end $$;

-- old alerts go away after 60 days
create or replace function public.parent_alerts_cleanup() returns void
language sql security definer set search_path = public as $$
    delete from parent_alerts where created_at < now() - interval '60 days';
$$;
do $$
begin
    if exists (select 1 from cron.job where jobname = 'attendreem-parent-alerts-cleanup') then
        perform cron.unschedule('attendreem-parent-alerts-cleanup');
    end if;
    perform cron.schedule('attendreem-parent-alerts-cleanup', '20 18 * * *', 'select public.parent_alerts_cleanup()');
end $$;

-- nobody calls these through the API (they run from triggers and the schedule)
revoke execute on function public.parent_alerts_cleanup() from public, anon, authenticated;
revoke execute on function public.queue_parent_absent() from public, anon, authenticated;
revoke execute on function public.queue_parent_announce() from public, anon, authenticated;
revoke execute on function public.queue_parent_spp_rejected() from public, anon, authenticated;
