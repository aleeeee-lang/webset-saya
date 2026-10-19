-- ============================================================
-- SPP: where to pay (school bank accounts / e-wallets)
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- The admin lists up to 5 ways to pay SPP, e.g.
--   [{"method":"Bank BRI","number":"1234-5678-9012","name":"SMA Contoh"},
--    {"method":"DANA","number":"0812-3456-7890","name":"Bendahara Sekolah"}]
-- Students and parents see the list (with a copy button) on the SPP page.
-- The existing policies already let everyone signed in read spp_settings and
-- only admins change it, so nobody else can swap the account numbers.

alter table public.spp_settings add column if not exists pay_methods jsonb not null default '[]'::jsonb;

alter table public.spp_settings drop constraint if exists spp_pay_methods_shape;
alter table public.spp_settings add constraint spp_pay_methods_shape
    check (jsonb_typeof(pay_methods) = 'array' and jsonb_array_length(pay_methods) <= 5);
