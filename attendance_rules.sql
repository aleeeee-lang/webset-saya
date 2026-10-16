-- ============================================================
-- ATTENDANCE RULES: check-in is checked by the server, not the phone
-- ============================================================
-- Run in Supabase -> SQL Editor (part by part is fine). Safe to re-run.
--
-- What it does:
--  0) allows the roles guru and orangtua in profiles (admin could not add them)
--  1) every agenda date (holidays table) gets an on/off switch for check-in:
--       attendance_open = false -> nobody can check in that day, and the day
--                                  is not counted (no Alpa, no Hadir)
--       attendance_open = true  -> check-in is open that day, even on a day
--                                  that is normally not a school day (e.g. a
--                                  Saturday school event); it counts as a school day
--       attendance_open = null  -> follow the class schedule (old rows)
--  2) public.att_day_open(class, date): the one rule used everywhere
--  3) a student's own check-in is checked on the server:
--       - date and time are taken from the server clock (Asia/Jakarta),
--         so changing the phone's clock does nothing
--       - the day must be open (rule above)
--       - the time must be inside the class's opening hours
--         (or inside the late window when "Mark late" is chosen)
--       - only one check-in per student per day
--  4) the Juara (champions) rankings skip days that are closed

-- 0) roles -----------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
    check (role in ('murid', 'guru', 'orangtua', 'admin'));

-- 1) on/off switch per agenda date ----------------------------------------
alter table public.holidays add column if not exists attendance_open boolean;
-- holidays that already exist: closed
update public.holidays set attendance_open = false
where type = 'holiday' and attendance_open is null;

-- admins may switch it later (there was no update policy yet)
drop policy if exists holidays_update_admin on public.holidays;
create policy holidays_update_admin on public.holidays for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- 2) is check-in open for this class on this date? -------------------------
create or replace function public.att_day_open(p_class text, p_date date)
returns boolean
language sql stable security definer set search_path = public as $$
    with ag as (
        select bool_or(coalesce(attendance_open, type <> 'holiday') = false) as closed,
               bool_or(attendance_open = true) as forced_open
        from holidays where date = p_date
    )
    select case
        when (select closed from ag) then false
        when (select forced_open from ag) then true
        else coalesce((
            select s.active_days @> to_jsonb(extract(isodow from p_date)::int)
            from attendance_schedules s where s.class = p_class
        ), true)    -- class without a schedule: every day is allowed
    end;
$$;
revoke execute on function public.att_day_open(text, date) from public, anon;
grant execute on function public.att_day_open(text, date) to authenticated;

-- 3) server-side check of a student's own check-in ------------------------
create or replace function public.guard_self_attendance()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
    p record;
    s record;
    now_local timestamp := now() at time zone 'Asia/Jakarta';
    t time := (now() at time zone 'Asia/Jakarta')::time;
begin
    if auth.uid() is null or is_admin() then return new; end if;
    -- a teacher filling in for a student is checked by the policies, not here
    if new.user_id is distinct from auth.uid() then return new; end if;

    -- date, time and weekday always come from the server clock
    new.date := now_local::date;
    new.time := date_trunc('minute', t)::time;
    new.day  := trim(to_char(now_local, 'FMDay'));

    select name, class into p from profiles where id = auth.uid();
    new.name  := p.name;
    new.class := p.class;

    -- one check-in per day (the lock stops a double tap from slipping through)
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text || new.date::text));
    if exists (select 1 from attendance where user_id = auth.uid() and date = new.date) then
        raise exception 'ATT_ALREADY' using hint = 'You already checked in today';
    end if;

    if not public.att_day_open(p.class, new.date) then
        raise exception 'ATT_DAY_CLOSED' using hint = 'Check-in is closed today';
    end if;

    select * into s from attendance_schedules where class = p.class;
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

    return new;
end $$;
-- (the trigger guard_self_attendance already exists and keeps using this function)

-- 4) Juara: closed days do not count ---------------------------------------
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
         and public.att_day_open(p.class, a.date)
    where p.role = 'murid' and p.class = target_class and coalesce(p.status, 'active') <> 'inactive'
      and public.can_view_class(target_class)
    group by p.id, p.name, p.avatar_url;
$$;

create or replace function public.champ_daily(target_class text, d_from date, d_to date)
returns table (day date, hadir int, total int)
language sql stable security definer set search_path = public as $$
    select a.date, count(*) filter (where a.status = 'Hadir')::int, count(*)::int
    from attendance a
    where a.class = target_class and a.date between d_from and d_to and public.can_view_class(target_class)
      and public.att_day_open(target_class, a.date)
    group by a.date order by a.date;
$$;

revoke execute on function public.champ_attendance(text, date, date) from public, anon;
grant execute on function public.champ_attendance(text, date, date) to authenticated;
