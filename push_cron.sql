-- ============================================================
-- PUSH NOTIFICATIONS: run the reminder function every 15 minutes
-- ============================================================
-- Run once in Supabase -> SQL Editor, AFTER the task-reminders
-- Edge Function is deployed. Safe to re-run.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'attendreem-task-reminders';

select cron.schedule(
    'attendreem-task-reminders',
    '*/15 * * * *',
    $$
    select net.http_post(
        url := 'https://vqpxumrodadqqaxuyehy.supabase.co/functions/v1/task-reminders',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'ISI_CRON_SECRET_DI_SINI'),
        body := '{}'::jsonb
    );
    $$
);
