-- security_fixes_3.sql
-- Locks down the helper functions added today (leave_teacher.sql, parent_alerts.sql)
-- after the Supabase security check. Changes no data. Safe to run more than once;
-- a function that isn't there is simply skipped.

-- the alert / push functions only ever run from the database itself (triggers and the
-- 10-minute schedule): nobody needs to call them through the app's API
do $$
declare f text;
begin
    foreach f in array array['parent_alerts_cleanup()', 'parent_daily_alerts()', 'queue_parent_absent()',
                             'queue_parent_announce()', 'queue_parent_spp_rejected()', 'queue_teacher_leave_push()'] loop
        if to_regprocedure('public.' || f) is not null then
            execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
        end if;
    end loop;
    -- a fixed search path for the small name helper
    if to_regprocedure('public.parent_first_name(text)') is not null then
        alter function public.parent_first_name(text) set search_path = public;
    end if;
end $$;
