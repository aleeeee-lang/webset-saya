-- ============================================================
-- "BACKUP SEMUA DATA" (Pengaturan -> admin)
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- admin_backup() returns every important table as one JSON document, which the
-- Settings page saves as a file on the admin's device. Only admins can call it.
-- Left out on purpose:
--   * private things of each person: personal notes, personal savings;
--   * fingerprint keys, phone notification addresses, QR codes, one-time tickets;
--   * notification queues / "already sent" logs (rebuilt by themselves);
--   * photos (they stay in Storage; the file only keeps their paths).

create or replace function public.admin_backup()
returns json
language plpgsql stable security definer set search_path = public as $$
declare
    t text;
    res jsonb := '{}'::jsonb;
    rows jsonb;
    counts jsonb := '{}'::jsonb;
    wanted text[] := array[
        'schools', 'school_info', 'school_location', 'profiles', 'parent_links',
        'attendance', 'attendance_schedules', 'attendance_period_settings', 'leave_requests',
        'class_schedules', 'holidays', 'tasks', 'task_done',
        'student_grades', 'student_activities', 'achievements', 'learning_goals',
        'piket_assignments', 'piket_logs',
        'savings', 'spp_settings', 'spp_payments',
        'class_cash_settings', 'class_cash_entries', 'class_cash_proofs',
        'broadcasts', 'feedback', 'notif_prefs', 'fp_changes', 'audit_log'];
begin
    if auth.uid() is null or not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
    foreach t in array wanted loop
        if to_regclass('public.' || t) is null then continue; end if;   -- older database
        execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t) into rows;
        res := res || jsonb_build_object(t, rows);
        counts := counts || jsonb_build_object(t, jsonb_array_length(rows));
    end loop;
    return json_build_object(
        'app', 'Attendreem',
        'kind', 'backup',
        'version', 1,
        'created_at', now(),
        'school_time', to_char(now() at time zone public.school_tz(), 'YYYY-MM-DD HH24:MI'),
        'by', (select name from profiles where id = auth.uid()),
        'counts', counts,
        'tables', res);
end $$;
revoke execute on function public.admin_backup() from public, anon;
grant execute on function public.admin_backup() to authenticated;
