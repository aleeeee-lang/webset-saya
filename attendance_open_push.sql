-- ============================================================
-- NOTIFICATION WHEN CHECK-IN OPENS
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- When a class's check-in time starts (Kelola Jadwal: "buka" time), every student of
-- that class who hasn't checked in yet gets a phone notification "Absen sudah dibuka".
-- Not on holidays / closed days, and only once per student per day. Students can switch
-- it off in Notifikasi ("Absen dibuka"). Sent by the task-reminders Edge Function.

alter table public.notif_prefs add column if not exists att_open boolean not null default true;

create table if not exists public.att_open_push_log (
    class text not null,
    day date not null,
    user_id uuid not null references profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (class, day, user_id)
);
alter table public.att_open_push_log enable row level security;   -- only the server writes it

-- the Edge Function (service role) asks whether check-in is open on a day
grant execute on function public.att_day_open(text, date) to service_role;
