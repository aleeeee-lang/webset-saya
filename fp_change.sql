-- ============================================================
-- FINGERPRINT: students change their phone themselves
-- ============================================================
-- Run in Supabase -> SQL Editor, AFTER attendance_security.sql. Safe to re-run.
--
-- A student can move fingerprint check-in to a new phone without the admin:
--   * first a face check with the camera (random moves); the photo is kept
--   * at most once every 7 days (the admin can still reset any time)
--   * admins, the parent and the student get a notification (just to know)
-- The "webauthn" Edge Function does the change; this file adds what it needs.

-- 1) a third kind of open challenge: 'change'
alter table public.webauthn_challenges drop constraint if exists webauthn_challenges_kind_check;
alter table public.webauthn_challenges add constraint webauthn_challenges_kind_check
    check (kind in ('register', 'auth', 'change'));

-- 2) history of phone changes (with the face photo taken just before)
create table if not exists public.fp_changes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references profiles(id) on delete cascade,
    photo_path text not null,                   -- bucket attendance-photos
    old_credential_id text,
    created_at timestamptz not null default now()
);
create index if not exists fp_changes_user_idx on public.fp_changes (user_id, created_at desc);
alter table public.fp_changes enable row level security;
drop policy if exists fp_changes_select on public.fp_changes;
create policy fp_changes_select on public.fp_changes for select to authenticated
    using (user_id = auth.uid() or public.is_admin());
-- no insert/update/delete policies: only the Edge Function (service role) writes here

-- 3) admins can turn the "phone changed" notification off in Settings -> Notifications
alter table public.notif_prefs add column if not exists admin_fp boolean not null default true;
