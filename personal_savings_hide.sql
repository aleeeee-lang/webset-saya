-- Tabungan pribadi: "Hapus dari riwayat saja" (saldo tetap)
--
-- Adds a "hidden" flag. A hidden row disappears from the history list but still
-- counts in the balance. Only the student who owns the row can hide it, through
-- hide_personal_saving(id); no general UPDATE permission is opened.
-- "Hapus & kembalikan saldo" keeps using the normal DELETE (balance goes back).
-- Safe to run again.

alter table public.personal_savings
    add column if not exists hidden boolean not null default false;

create or replace function public.hide_personal_saving(p_id uuid)
returns void
language sql security definer set search_path = public as $$
    update personal_savings set hidden = true
    where id = p_id and student_id = auth.uid();
$$;

revoke execute on function public.hide_personal_saving(uuid) from public, anon;
grant execute on function public.hide_personal_saving(uuid) to authenticated;
