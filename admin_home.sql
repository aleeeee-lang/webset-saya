-- ============================================================
-- BERANDA ADMIN: today's picture of the school in one call
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run. Read-only (changes no data).
--
-- admin_overview() returns, for today (school time zone):
--   students / teachers: how many checked in Hadir / Izin / Sakit / Alpa, and who hasn't yet;
--   classes:  the same per class (lowest attendance first on the page);
--   pending:  leave requests to approve, SPP proofs to check, new suggestions;
--   watch:    students with 3 or more absent days this month (Alpa, or a school day
--             with no check-in at all), counted only for classes that have check-in days
--             set in Jadwal absen, from the day the account was made, up to yesterday.
-- Only admins can call it.

create or replace function public.admin_overview()
returns json
language plpgsql stable security definer set search_path = public as $$
declare
    tz text := public.school_tz();
    d date := (now() at time zone tz)::date;
    m0 date := date_trunc('month', (now() at time zone tz))::date;
    res json;
begin
    if auth.uid() is null or not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;

    with studs as (
        select id, name, class, coalesce((created_at at time zone tz)::date, m0) as joined
        from profiles where role = 'murid' and coalesce(status, 'active') <> 'inactive'
    ),
    teach as (
        select id from profiles where role = 'guru' and coalesce(status, 'active') <> 'inactive'
    ),
    att as (select user_id, status from attendance where date = d),
    s_today as (
        select count(*) as total,
               count(*) filter (where a.status = 'Hadir') as hadir,
               count(*) filter (where a.status = 'Izin') as izin,
               count(*) filter (where a.status = 'Sakit') as sakit,
               count(*) filter (where a.status = 'Alpa') as alpa,
               count(*) filter (where a.user_id is null) as belum
        from studs s left join att a on a.user_id = s.id
    ),
    t_today as (
        select count(*) as total,
               count(*) filter (where a.status = 'Hadir') as hadir,
               count(*) filter (where a.status in ('Izin', 'Sakit')) as izin_sakit,
               count(*) filter (where a.status = 'Alpa') as alpa,
               count(*) filter (where a.user_id is null) as belum
        from teach t left join att a on a.user_id = t.id
    ),
    per_class as (
        select s.class, count(*) as total,
               count(*) filter (where a.status = 'Hadir') as hadir,
               count(*) filter (where a.status in ('Izin', 'Sakit')) as izin_sakit,
               count(*) filter (where a.status = 'Alpa') as alpa,
               count(*) filter (where a.user_id is null) as belum,
               public.att_day_open(s.class, d) as open_today
        from studs s left join att a on a.user_id = s.id
        where s.class is not null
        group by s.class
    ),
    days as (select g::date as day from generate_series(m0, d - 1, interval '1 day') g),
    class_days as (
        select sc.class, dd.day
        from attendance_schedules sc cross join days dd
        where sc.class <> 'Guru' and jsonb_array_length(coalesce(sc.active_days, '[]'::jsonb)) > 0
          and public.att_day_open(sc.class, dd.day)
    ),
    missed as (
        select s.id, s.name, s.class, count(*) as n
        from studs s
        join class_days cd on cd.class = s.class and cd.day >= s.joined
        left join attendance a on a.user_id = s.id and a.date = cd.day
        where a.user_id is null or a.status = 'Alpa'
        group by s.id, s.name, s.class
        having count(*) >= 3
    )
    select json_build_object(
        'date', d,
        'school_day', exists (select 1 from per_class where open_today),
        'students', (select row_to_json(x) from s_today x),
        'teachers', (select row_to_json(x) from t_today x),
        'classes', coalesce((select json_agg(row_to_json(c) order by
                        case when c.total > 0 then c.hadir::numeric / c.total else 1 end, c.class)
                     from per_class c), '[]'::json),
        'pending', json_build_object(
            'leave', (select count(*) from leave_requests where status = 'pending'),
            'spp', (select count(*) from spp_payments where status = 'pending'),
            'feedback', (select count(*) from feedback where coalesce(status, 'new') = 'new')),
        'watch', coalesce((select json_agg(json_build_object('id', w.id, 'name', w.name, 'class', w.class, 'n', w.n) order by w.n desc, w.name)
                  from (select * from missed order by n desc, name limit 5) w), '[]'::json),
        'watch_total', (select count(*) from missed)
    ) into res;
    return res;
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
