-- ============================================================
-- PUSH NOTIFICATIONS FOR THE LESSON SCHEDULE
-- ============================================================
-- Run once in Supabase -> SQL Editor, AFTER push.sql. Safe to re-run.
-- Purely additive: two small tables + a faster reminder schedule.

-- 1) Which reminders each person wants (no row = everything on).
create table if not exists notif_prefs (
    user_id uuid primary key references profiles(id) on delete cascade,
    tasks boolean not null default true,      -- task deadlines
    lessons boolean not null default true,    -- lesson starts in ~10 minutes
    updated_at timestamptz not null default now()
);
alter table notif_prefs enable row level security;
drop policy if exists "notif_prefs_select" on notif_prefs;
create policy "notif_prefs_select" on notif_prefs for select using (user_id = auth.uid());
drop policy if exists "notif_prefs_insert" on notif_prefs;
create policy "notif_prefs_insert" on notif_prefs for insert with check (user_id = auth.uid());
drop policy if exists "notif_prefs_update" on notif_prefs;
create policy "notif_prefs_update" on notif_prefs for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) Remembers which lesson reminder was already sent today (server only).
create table if not exists lesson_push_log (
    schedule_id uuid not null references class_schedules(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,
    day date not null,
    sent_at timestamptz not null default now(),
    primary key (schedule_id, user_id, day)
);
alter table lesson_push_log enable row level security;   -- only the server function (service role) uses it

-- 3) Check every 5 minutes instead of 15, so "10 minutes before" stays on time.
select cron.alter_job(jobid, schedule := '*/5 * * * *')
from cron.job where jobname = 'attendreem-task-reminders';
