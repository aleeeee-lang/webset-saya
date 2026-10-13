-- ============================================================
-- SECURITY FIXES (after the policy review)
-- ============================================================
-- Run once in Supabase -> SQL Editor. Safe to re-run.

-- 1) Students can only check in for TODAY, and their name/class on the
--    attendance row always comes from their real profile.
--    (Admins and teachers entering attendance for students are not affected.)
create or replace function guard_self_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    p record;
begin
    if auth.uid() is null or is_admin() then return new; end if;
    if new.user_id is distinct from auth.uid() then return new; end if;   -- teacher entry, checked by its own policy

    -- "today" anywhere in Indonesia (WIB .. WIT)
    if new.date::date < (now() at time zone 'Asia/Jakarta')::date
       or new.date::date > (now() at time zone 'Asia/Jayapura')::date then
        raise exception 'You can only check in for today';
    end if;

    select name, class into p from profiles where id = auth.uid();
    new.name := p.name;
    new.class := p.class;
    return new;
end $$;

drop trigger if exists guard_self_attendance on attendance;
create trigger guard_self_attendance
    before insert on attendance
    for each row execute function guard_self_attendance();

-- 2) Notifications: everyone sees messages for everyone / their class /
--    themselves, but not messages sent privately to another student.
drop policy if exists "Allow authenticated read broadcasts" on broadcasts;
drop policy if exists "broadcasts_select_target" on broadcasts;
create policy "broadcasts_select_target" on broadcasts for select to authenticated using (
    is_admin()
    or target_type = 'all'
    or (target_type = 'class' and target_value = my_class())
    or (target_type = 'student' and target_value = auth.uid()::text)
);
