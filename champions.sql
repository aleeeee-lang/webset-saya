-- ============================================================
-- CHAMPIONS (Juara): attendance champions, grade ranking,
-- competition achievements and the most diligent class
-- ============================================================
-- Run once in Supabase -> SQL Editor. Safe to re-run. Purely additive.
-- Privacy: other students' grades are never sent to a student - only the
-- top 3 names/averages and the student's own rank.

-- 1) Achievements that are celebrated for a while (default 7 days) and then
--    stay in the Juara page: competition wins and announced class rankings.
create table if not exists achievements (
    id uuid primary key default gen_random_uuid(),
    kind text not null default 'competition' check (kind in ('competition', 'rank')),
    title text not null,                     -- e.g. "Juara 1 Olimpiade Matematika"
    event_name text,                         -- e.g. "OSN Kabupaten 2026"
    level text,                              -- sekolah / kecamatan / kota / provinsi / nasional / internasional
    rank_label text,                         -- e.g. "Juara 1", "Harapan 2"
    student_id uuid references profiles(id) on delete set null,
    student_name text,
    class text,
    period text,                             -- for kind = 'rank'
    details jsonb,                           -- for kind = 'rank': top 3 [{name, avg}]
    photo_path text,                         -- certificate/photo (bucket achievement-photos)
    achieved_on date not null default current_date,
    show_until timestamptz not null default now() + interval '7 days',
    created_by uuid references profiles(id) on delete set null,
    created_by_name text,
    created_at timestamptz not null default now()
);
create index if not exists achievements_recent_idx on achievements (achieved_on desc);

alter table achievements enable row level security;
drop policy if exists "achievements_select" on achievements;
create policy "achievements_select" on achievements for select to authenticated using (true);
drop policy if exists "achievements_insert" on achievements;
create policy "achievements_insert" on achievements for insert to authenticated
    with check (created_by = auth.uid() and (public.is_admin()
        or exists (select 1 from profiles where id = auth.uid() and role = 'guru')));
drop policy if exists "achievements_delete" on achievements;
create policy "achievements_delete" on achievements for delete to authenticated
    using (public.is_admin() or created_by = auth.uid());

-- certificate / photo of the win (only signed-in users can open them)
insert into storage.buckets (id, name, public) values ('achievement-photos', 'achievement-photos', false)
on conflict (id) do nothing;
drop policy if exists "achievement_photos_insert" on storage.objects;
create policy "achievement_photos_insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'achievement-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "achievement_photos_select" on storage.objects;
create policy "achievement_photos_select" on storage.objects for select to authenticated
    using (bucket_id = 'achievement-photos');

-- who may look at a class's rankings
create or replace function public.can_view_class(target_class text) returns boolean
language sql stable security definer set search_path = public as $$
    select target_class = public.my_class() or public.is_teaching_class(target_class) or public.is_admin();
$$;

-- 2) Attendance champions of a class: present days per student (+ average check-in time)
--    (avatar_url so the podium can show the profile photo)
drop function if exists public.champ_attendance(text, date, date);
create or replace function public.champ_attendance(target_class text, d_from date, d_to date)
returns table (user_id uuid, name text, hadir int, total int, avg_time text, avatar_url text)
language sql stable security definer set search_path = public as $$
    select p.id, p.name,
           count(a.id) filter (where a.status = 'Hadir')::int,
           count(a.id)::int,
           to_char(avg(a.time - time '00:00') filter (where a.status = 'Hadir'), 'HH24.MI'),
           p.avatar_url
    from profiles p
    left join attendance a on a.user_id = p.id and a.date between d_from and d_to
    where p.role = 'murid' and p.class = target_class and coalesce(p.status, 'active') <> 'inactive'
      and public.can_view_class(target_class)
    group by p.id, p.name, p.avatar_url;
$$;

-- 3) Daily attendance of a class (for the chart)
create or replace function public.champ_daily(target_class text, d_from date, d_to date)
returns table (day date, hadir int, total int)
language sql stable security definer set search_path = public as $$
    select a.date, count(*) filter (where a.status = 'Hadir')::int, count(*)::int
    from attendance a
    where a.class = target_class and a.date between d_from and d_to and public.can_view_class(target_class)
    group by a.date order by a.date;
$$;

-- 4) Grade ranking of a class for one period:
--    students get the top 3 plus their own row; teachers/admins get everyone
drop function if exists public.champ_grades(text, text);
create or replace function public.champ_grades(target_class text, p_period text)
returns table (user_id uuid, name text, avg_score numeric, subjects int, rnk int, avatar_url text)
language sql stable security definer set search_path = public as $$
    with r as (
        select p.id, p.name, p.avatar_url, round(avg(g.score)::numeric, 1) as av, count(*)::int as n,
               rank() over (order by avg(g.score) desc)::int as rk
        from student_grades g join profiles p on p.id = g.user_id
        where p.role = 'murid' and p.class = target_class and g.period = p_period
          and public.can_view_class(target_class)
        group by p.id, p.name, p.avatar_url
    )
    select id, name, av, n, rk, avatar_url from r
    where rk <= 3 or id = auth.uid() or public.is_admin() or public.is_teaching_class(target_class)
    order by rk;
$$;

create or replace function public.champ_grade_periods(target_class text)
returns table (period text)
language sql stable security definer set search_path = public as $$
    select distinct g.period from student_grades g join profiles p on p.id = g.user_id
    where p.class = target_class and g.period is not null and public.can_view_class(target_class)
    order by 1 desc;
$$;

-- 5) Most diligent class: attendance rate per class (totals only, no names)
create or replace function public.champ_classes(d_from date, d_to date)
returns table (class text, hadir int, total int, students int)
language sql stable security definer set search_path = public as $$
    select a.class, count(*) filter (where a.status = 'Hadir')::int, count(*)::int, count(distinct a.user_id)::int
    from attendance a
    where a.date between d_from and d_to and a.class is not null and auth.uid() is not null
    group by a.class;
$$;

-- 6) Profile photos of the students named in achievements (photo URL only)
create or replace function public.champ_avatars(ids uuid[])
returns table (id uuid, avatar_url text)
language sql stable security definer set search_path = public as $$
    select p.id, p.avatar_url from profiles p
    where p.id = any(ids) and p.avatar_url is not null and auth.uid() is not null;
$$;

revoke execute on function public.champ_avatars(uuid[]) from public, anon;
grant execute on function public.champ_avatars(uuid[]) to authenticated;
revoke execute on function public.champ_attendance(text, date, date) from public, anon;
revoke execute on function public.champ_daily(text, date, date) from public, anon;
revoke execute on function public.champ_grades(text, text) from public, anon;
revoke execute on function public.champ_grade_periods(text) from public, anon;
revoke execute on function public.champ_classes(date, date) from public, anon;
revoke execute on function public.can_view_class(text) from public, anon;
grant execute on function public.champ_attendance(text, date, date) to authenticated;
grant execute on function public.champ_daily(text, date, date) to authenticated;
grant execute on function public.champ_grades(text, text) to authenticated;
grant execute on function public.champ_grade_periods(text) to authenticated;
grant execute on function public.champ_classes(date, date) to authenticated;
grant execute on function public.can_view_class(text) to authenticated;

-- 7) Phone notification when a new achievement is published (everyone with notifications on)
create or replace function queue_achievement_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    begin
        insert into push_queue (user_id, title, body, url, tag)
        select distinct ps.user_id,
               case when new.kind = 'rank' then '🏆 Juara kelas ' || coalesce(new.class, '') else '🏆 Selamat, ' || coalesce(new.student_name, '') || '!' end,
               left(case when new.kind = 'rank' then coalesce(new.title, '')
                         else coalesce(new.title, '') || coalesce(' · ' || new.event_name, '') end, 180),
               'juara.html', 'achievement-' || new.id
        from push_subscriptions ps
        join profiles p on p.id = ps.user_id
        where ps.user_id is distinct from new.created_by
          and (new.kind <> 'rank' or p.class = new.class or p.role in ('guru', 'admin', 'orangtua'));
    exception when others then
        raise warning 'queue_achievement_push: %', sqlerrm;
    end;
    return new;
end $$;
drop trigger if exists queue_achievement_push on achievements;
create trigger queue_achievement_push after insert on achievements
    for each row execute function queue_achievement_push();
revoke execute on function queue_achievement_push() from public, anon, authenticated;
