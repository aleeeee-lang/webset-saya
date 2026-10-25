-- ============================================================
-- SECURITY HARDENING (Supabase "Advisors" warnings)
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run. Nothing about how the app works changes:
--   * people who are NOT logged in can no longer call the app's database functions
--     (only the clock functions stay open, the login page uses them);
--   * trigger functions can't be called directly by anyone (they only run as triggers anyway);
--   * geo_distance_m gets a fixed search_path.
-- Logged-in students, teachers, parents and admins keep exactly the same access.

do $$
declare f record;
begin
    for f in
        select p.oid::regprocedure as sig, p.proname,
               pg_get_function_result(p.oid) = 'trigger' as is_trigger,
               has_function_privilege('authenticated', p.oid, 'execute') as had_auth,
               has_function_privilege('service_role', p.oid, 'execute') as had_service
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and p.proname not in ('server_clock', 'school_tz', 'school_today')
    loop
        -- keep what logged-in users and the server could already do (the grant may have come via PUBLIC)
        if f.had_auth and not f.is_trigger then execute format('grant execute on function %s to authenticated', f.sig); end if;
        if f.had_service then execute format('grant execute on function %s to service_role', f.sig); end if;
        execute format('revoke execute on function %s from public, anon', f.sig);
        if f.is_trigger then
            execute format('revoke execute on function %s from authenticated', f.sig);
        end if;
    end loop;
end $$;

alter function public.geo_distance_m(double precision, double precision, double precision, double precision)
    set search_path = public;

-- check: should list only server_clock, school_tz, school_today
select p.proname as still_open_to_guests
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
order by 1;
