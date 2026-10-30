-- Juara kehadiran chart: count students who didn't check in at all ("auto Alpa")
--
-- Before: a day's % was Hadir / students WITH an attendance row that day, so a day
-- nobody checked in on was missing, and students who skipped didn't lower the %.
-- Now: every school day of the range (att_day_open: weekdays / holidays of the class),
-- up to yesterday (today only once someone has checked in), and the total is every
-- student of the class who was already there that day - from the later of the day
-- the account was made and their first check-in (the same start the app uses for
-- auto Alpa), until the day they left.
-- Same name, inputs and outputs as before: the app needs no change. Safe to run again.

create or replace function public.champ_daily(target_class text, d_from date, d_to date)
returns table (day date, hadir int, total int)
language sql stable security definer set search_path = public as $$
    with rec as (
        select a.date as day,
               count(*) filter (where a.status = 'Hadir')::int as h,
               count(*)::int as n
        from attendance a
        where a.class = target_class and a.date between d_from and d_to
        group by a.date
    ),
    st as (
        select p.id,
               greatest((p.created_at at time zone public.school_tz())::date, min(a.date)) as since,
               p.left_date, p.status
        from profiles p
        join attendance a on a.user_id = p.id
        where p.role = 'murid' and p.class = target_class
        group by p.id
    ),
    cal as (
        select g::date as day
        from generate_series(d_from, least(d_to, public.school_today() - 1), interval '1 day') g
        where public.att_day_open(target_class, g::date)
        union
        select day from rec
    ),
    x as (
        select c.day, coalesce(r.h, 0) as h, coalesce(r.n, 0) as n,
               (select count(*) from st
                 where st.since <= c.day
                   and (st.left_date is null or st.left_date >= c.day)
                   and (coalesce(st.status, 'active') <> 'inactive' or st.left_date is not null))::int as roster
        from cal c
        left join rec r on r.day = c.day
    )
    select x.day, x.h, greatest(x.n, x.roster)::int
    from x
    where public.can_view_class(target_class) and greatest(x.n, x.roster) > 0
    order by x.day;
$$;

revoke execute on function public.champ_daily(text, date, date) from public, anon;
grant execute on function public.champ_daily(text, date, date) to authenticated;
