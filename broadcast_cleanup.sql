-- ============================================================
-- ANNOUNCEMENTS: admin can delete, and old ones clean themselves up
-- ============================================================
-- Run once in Supabase -> SQL Editor. Safe to re-run.

-- 1) Admins may delete an announcement (e.g. a typo or one that is no longer valid)
drop policy if exists "broadcasts_delete_admin" on broadcasts;
create policy "broadcasts_delete_admin" on broadcasts for delete to authenticated using (is_admin());

-- 2) Every night at 00:05 WIB, remove announcements older than 30 days
select cron.unschedule(jobid) from cron.job where jobname = 'attendreem-broadcast-cleanup';
select cron.schedule(
    'attendreem-broadcast-cleanup',
    '5 17 * * *',                      -- 17:05 UTC = 00:05 WIB
    $$ delete from public.broadcasts where created_at < now() - interval '30 days' $$
);
