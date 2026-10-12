-- ============================================================
-- PROFILE BIO — short text shown under the name on "My Attendance"
-- ============================================================
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Until this is run, the app keeps the bio in the user's own
-- account data instead (only that user can see it).

alter table profiles add column if not exists bio text;

-- keep it short (same limit as the app: 80 characters)
alter table profiles drop constraint if exists profiles_bio_length;
alter table profiles add constraint profiles_bio_length check (bio is null or char_length(bio) <= 80);
