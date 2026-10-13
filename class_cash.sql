-- ============================================================
-- CLASS CASH (uang kas kelas)
-- ============================================================
-- Run once in Supabase -> SQL Editor. Safe to re-run. Purely additive.
-- Who can do what:
--   * every student sees their own class's balance and history
--   * the class treasurer (bendahara), the homeroom teacher and admins record money in / out
--   * the homeroom teacher and admins choose the treasurer and the dues amount

-- 1) Settings per class
create table if not exists class_cash_settings (
    class text primary key,
    treasurer_id uuid references profiles(id) on delete set null,
    treasurer_name text,
    dues_amount integer not null default 5000 check (dues_amount >= 0),
    dues_period text not null default 'weekly' check (dues_period in ('weekly', 'monthly')),
    updated_at timestamptz not null default now()
);

-- 2) Every money movement
create table if not exists class_cash_entries (
    id uuid primary key default gen_random_uuid(),
    class text not null,
    kind text not null check (kind in ('in', 'out')),
    category text not null default 'other' check (category in ('dues', 'other')),
    amount integer not null check (amount > 0),
    note text,
    student_id uuid references profiles(id) on delete set null,   -- who paid (dues)
    student_name text,
    period_key text,                                              -- dues: '2026-W42' or '2026-10'
    receipt_path text,                                            -- photo of the receipt (bucket cash-receipts)
    entry_date date not null default current_date,
    created_by uuid references profiles(id) on delete set null,
    created_by_name text,
    created_at timestamptz not null default now()
);
create index if not exists class_cash_entries_class_idx on class_cash_entries (class, entry_date desc);
create unique index if not exists class_cash_dues_once on class_cash_entries (class, student_id, period_key) where category = 'dues';

-- 3) Who may record money for a class
create or replace function public.can_manage_cash(target_class text) returns boolean
language sql stable security definer set search_path = public as $$
    select public.is_admin()
        or public.is_teacher_of_class(target_class)
        or exists (select 1 from class_cash_settings s
                   where s.class = target_class and s.treasurer_id = auth.uid() and public.my_class() = target_class);
$$;

-- 4) Row-level security
alter table class_cash_settings enable row level security;
drop policy if exists "cash_settings_select" on class_cash_settings;
create policy "cash_settings_select" on class_cash_settings for select to authenticated
    using (class = public.my_class() or public.is_teaching_class(class) or public.is_admin());
drop policy if exists "cash_settings_write" on class_cash_settings;
create policy "cash_settings_write" on class_cash_settings for all to authenticated
    using (public.is_admin() or public.is_teacher_of_class(class))
    with check (public.is_admin() or public.is_teacher_of_class(class));

alter table class_cash_entries enable row level security;
drop policy if exists "cash_entries_select" on class_cash_entries;
create policy "cash_entries_select" on class_cash_entries for select to authenticated
    using (class = public.my_class() or public.is_teaching_class(class) or public.is_admin());
drop policy if exists "cash_entries_insert" on class_cash_entries;
create policy "cash_entries_insert" on class_cash_entries for insert to authenticated
    with check (public.can_manage_cash(class) and created_by = auth.uid());
drop policy if exists "cash_entries_delete" on class_cash_entries;
create policy "cash_entries_delete" on class_cash_entries for delete to authenticated
    using (public.can_manage_cash(class));

-- 5) Names of the students in a class, for the treasurer's dues checklist
--    (only id + name; other profile details stay private)
create or replace function public.class_cash_members(target_class text)
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
    select p.id, p.name from profiles p
    where p.role = 'murid' and p.class = target_class and coalesce(p.status, 'active') <> 'inactive'
      and public.can_manage_cash(target_class)
    order by p.name;
$$;
revoke execute on function public.class_cash_members(text) from public, anon;
grant execute on function public.class_cash_members(text) to authenticated;

-- 6) Receipt photos (private bucket; visible to whoever can see the entry)
insert into storage.buckets (id, name, public) values ('cash-receipts', 'cash-receipts', false)
on conflict (id) do nothing;
drop policy if exists "cash_receipts_insert" on storage.objects;
create policy "cash_receipts_insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'cash-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "cash_receipts_select" on storage.objects;
create policy "cash_receipts_select" on storage.objects for select to authenticated
    using (bucket_id = 'cash-receipts' and exists (
        select 1 from public.class_cash_entries e where e.receipt_path = storage.objects.name
          and (e.class = public.my_class() or public.is_teaching_class(e.class) or public.is_admin())));
