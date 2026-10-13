-- ============================================================
-- EXAM REMINDERS (from the academic calendar, type = 'exam')
-- ============================================================
-- Run once in Supabase -> SQL Editor. Safe to re-run.

-- 1) One more on/off choice in Settings ("Exams")
alter table notif_prefs add column if not exists exams boolean not null default true;

-- 2) Remembers which exam reminder each person already got (server only)
create table if not exists exam_push_log (
    holiday_id uuid not null references holidays(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,
    stage text not null,               -- h3 | h1 | h0
    sent_at timestamptz not null default now(),
    primary key (holiday_id, user_id, stage)
);
alter table exam_push_log enable row level security;
