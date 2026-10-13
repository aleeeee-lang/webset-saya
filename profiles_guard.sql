-- ============================================================
-- PROFILES GUARD: only admins can change important profile fields
-- ============================================================
-- Run once in Supabase -> SQL Editor. Safe to re-run.
--
-- Students, teachers and parents may still change their OWN photo
-- (avatar_url) and bio. Everything else on a profile (role, class,
-- NIS, name, status, SPP amount, ...) can only be changed by an admin.
-- Changes made from the Supabase dashboard / SQL editor / server
-- functions are not affected (there is no signed-in app user there).

create or replace function guard_profile_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    allowed text[] := array['avatar_url', 'bio', 'updated_at'];
begin
    -- dashboard, SQL editor, server functions: no app user -> allow
    if auth.uid() is null then return new; end if;
    if is_admin() then return new; end if;

    if tg_op = 'INSERT' then
        -- a non-admin may only ever create their own profile, and only as a student
        if new.id is distinct from auth.uid() then
            raise exception 'Not allowed to create a profile for someone else';
        end if;
        new.role := 'murid';
        return new;
    end if;

    -- UPDATE: compare everything except the allowed columns
    if new.id is distinct from auth.uid() then
        raise exception 'Not allowed to change someone else''s profile';
    end if;
    if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
        raise exception 'Only an admin can change role, class, name, NIS or status';
    end if;
    return new;
end $$;

drop trigger if exists guard_profile_changes on profiles;
create trigger guard_profile_changes
    before insert or update on profiles
    for each row execute function guard_profile_changes();
