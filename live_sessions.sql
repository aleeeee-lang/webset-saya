-- ============================================================
-- LIVE SESSION RECAP (Dasbor admin / Beranda guru)
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- live_sessions() answers, for right now (school time zone):
--   sessions: every lesson that is going on now (from the lesson schedule), with
--             how many students of that class are Hadir / Izin / Sakit / Alpa /
--             not checked in yet today, how many were late, the last check-ins
--             and who is still missing;
--   classes:  the same numbers for every class today (shown when no lesson is on).
-- Admins see every class; teachers see the classes they teach or lead; a student
-- sees their own class, as numbers only (no names).
-- While a lesson is on, the page asks again every few seconds; with no lesson it stops
-- and only wakes up when the next lesson starts (next_in) or the page is opened again.

create or replace function public.live_sessions()
returns json
language plpgsql stable security definer set search_path = public as $$
declare
    tz text := public.school_tz();
    now_local timestamp := now() at time zone tz;
    d date := now_local::date;
    t time := now_local::time;
    dow int := extract(isodow from now_local)::int;
    adm boolean := public.is_admin();
    my_role text := (select role from profiles where id = auth.uid());
    my_cls text := (select class from profiles where id = auth.uid());
    stu boolean := false;
    res json;
begin
    if auth.uid() is null then raise exception 'NOT_ALLOWED'; end if;
    if not adm and my_role is distinct from 'guru' then
        if my_role = 'murid' and my_cls is not null then stu := true;
        else raise exception 'NOT_ALLOWED';
        end if;
    end if;

    with my_classes as (
        select distinct p.class from profiles p
        where p.role = 'murid' and p.class is not null and coalesce(p.status, 'active') <> 'inactive'
          and (case when stu then p.class = my_cls else (adm or public.is_teaching_class(p.class)) end)
    ),
    studs as (
        select p.id, p.name, p.class from profiles p
        join my_classes c on c.class = p.class
        where p.role = 'murid' and coalesce(p.status, 'active') <> 'inactive'
    ),
    att as (
        select a.user_id, a.status, a.time, a.reason, a.method from attendance a
        join studs s on s.id = a.user_id
        where a.date = d
    ),
    per_class as (
        select s.class,
               count(*) as total,
               count(*) filter (where a.status = 'Hadir') as hadir,
               count(*) filter (where a.status = 'Izin') as izin,
               count(*) filter (where a.status = 'Sakit') as sakit,
               count(*) filter (where a.status = 'Alpa') as alpa,
               count(*) filter (where a.status is null) as belum,
               count(*) filter (where a.status = 'Hadir' and coalesce(a.reason, '') like '[Telat]%') as telat,
               coalesce(json_agg(json_build_object('name', s.name, 'time', to_char(a.time, 'HH24.MI'), 'method', a.method)
                        order by a.time desc) filter (where a.status = 'Hadir'), '[]'::json) as present,
               coalesce(json_agg(s.name order by s.name) filter (where a.status is null), '[]'::json) as missing
        from studs s left join att a on a.user_id = s.id
        group by s.class
    ),
    now_lessons as (
        select cs.class, cs.subject, cs.room, cs.teacher_name, cs.start_time, cs.end_time
        from class_schedules cs join my_classes c on c.class = cs.class
        where cs.day = dow and cs.start_time <= t and cs.end_time > t
    )
    select json_build_object(
        'now', to_char(now_local, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'student', stu,
        -- seconds until the next lesson starts today (the page sleeps until then)
        'next_in', (select round(extract(epoch from (min(cs.start_time) - t)))::int
                    from class_schedules cs join my_classes c on c.class = cs.class
                    where cs.day = dow and cs.start_time > t),
        'tz', tz,
        'sessions', coalesce((
            select json_agg(json_build_object(
                'class', l.class, 'subject', l.subject, 'room', l.room, 'teacher', l.teacher_name,
                'start', to_char(l.start_time, 'HH24.MI'), 'end', to_char(l.end_time, 'HH24.MI'),
                'progress', round(extract(epoch from (t - l.start_time)) / nullif(extract(epoch from (l.end_time - l.start_time)), 0) * 100),
                'total', pc.total, 'hadir', pc.hadir, 'izin', pc.izin, 'sakit', pc.sakit, 'alpa', pc.alpa,
                'belum', pc.belum, 'telat', pc.telat,
                -- classmates' names stay with the teachers
                'present', case when stu then '[]'::json else pc.present end,
                'missing', case when stu then '[]'::json else pc.missing end)
                order by l.start_time, l.class)
            from now_lessons l join per_class pc on pc.class = l.class), '[]'::json),
        'classes', coalesce((
            select json_agg(json_build_object(
                'class', pc.class, 'total', pc.total, 'hadir', pc.hadir, 'izin', pc.izin, 'sakit', pc.sakit,
                'alpa', pc.alpa, 'belum', pc.belum, 'telat', pc.telat) order by pc.class)
            from per_class pc), '[]'::json)
    ) into res;
    return res;
end $$;
grant execute on function public.live_sessions() to authenticated;
