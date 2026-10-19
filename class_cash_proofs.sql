-- ============================================================
-- CLASS CASH: pay dues by transfer + send the proof
-- ============================================================
-- Run in Supabase -> SQL Editor (after class_cash.sql). Safe to re-run.
--
-- Paying cash to the treasurer still works exactly as before (the treasurer
-- ticks the name). This adds a second way:
--   1) the treasurer / homeroom teacher writes where to transfer (pay_info,
--      e.g. "DANA 0812xxxx a.n. Siti")
--   2) a student transfers, then sends a photo/screenshot of the proof
--   3) the treasurer accepts it (the dues are recorded and the balance goes up)
--      or rejects it with a reason (the student can send a new one)
-- The proof photo is private: only that student and whoever manages the class
-- cash (treasurer, homeroom teacher, admin) can open it.

-- 1) where to transfer
alter table public.class_cash_settings add column if not exists pay_info text;

-- the treasurer may change pay_info too (the rest of the settings stay with
-- the homeroom teacher / admin)
create or replace function public.set_cash_pay_info(target_class text, info text)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if not public.can_manage_cash(target_class) then
        raise exception 'NOT_ALLOWED';
    end if;
    insert into class_cash_settings (class, pay_info) values (target_class, nullif(trim(left(info, 120)), ''))
    on conflict (class) do update set pay_info = excluded.pay_info, updated_at = now();
end $$;
revoke execute on function public.set_cash_pay_info(text, text) from public, anon;
grant execute on function public.set_cash_pay_info(text, text) to authenticated;

-- 2) proofs sent by students
create table if not exists public.class_cash_proofs (
    id uuid primary key default gen_random_uuid(),
    class text not null,
    student_id uuid not null references profiles(id) on delete cascade,
    student_name text,
    period_key text not null,                 -- '2026-W42' or '2026-10', like the dues entries
    amount integer not null check (amount > 0),
    photo_path text not null,                 -- bucket cash-receipts, folder = student id
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
    reject_reason text,
    entry_id uuid references class_cash_entries(id) on delete set null,
    reviewed_by uuid references profiles(id) on delete set null,
    reviewed_by_name text,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists class_cash_proofs_class_idx on public.class_cash_proofs (class, status);
-- one waiting or accepted proof per student per period
create unique index if not exists class_cash_proofs_once on public.class_cash_proofs (student_id, period_key)
    where status in ('pending', 'approved');

alter table public.class_cash_proofs enable row level security;
drop policy if exists cash_proofs_select on public.class_cash_proofs;
create policy cash_proofs_select on public.class_cash_proofs for select to authenticated
    using (student_id = auth.uid() or public.can_manage_cash(class));
drop policy if exists cash_proofs_insert on public.class_cash_proofs;
create policy cash_proofs_insert on public.class_cash_proofs for insert to authenticated
    with check (student_id = auth.uid() and class = public.my_class());
-- no update/delete policies: accepting or rejecting goes through review_cash_proof()

-- the server fills in the details, so a student can't send a fake amount or status
create or replace function public.guard_cash_proof()
returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
    if auth.uid() is null or public.is_admin() then return new; end if;
    select * into s from class_cash_settings where class = new.class;
    if not found or coalesce(s.dues_amount, 0) <= 0 then
        raise exception 'CASH_NO_DUES';
    end if;
    if split_part(new.photo_path, '/', 1) <> auth.uid()::text then
        raise exception 'CASH_BAD_PHOTO';
    end if;
    if exists (select 1 from class_cash_entries e
               where e.class = new.class and e.category = 'dues'
                 and e.student_id = new.student_id and e.period_key = new.period_key) then
        raise exception 'CASH_ALREADY_PAID';
    end if;
    new.amount := s.dues_amount;
    new.status := 'pending';
    new.reject_reason := null;
    new.entry_id := null;
    new.reviewed_by := null; new.reviewed_by_name := null; new.reviewed_at := null;
    new.created_at := now();
    new.student_name := (select name from profiles where id = auth.uid());
    return new;
end $$;
drop trigger if exists guard_cash_proof on public.class_cash_proofs;
create trigger guard_cash_proof before insert on public.class_cash_proofs
    for each row execute function public.guard_cash_proof();

-- 3) the treasurer accepts or rejects a proof
create or replace function public.review_cash_proof(proof_id uuid, accept boolean, reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
    p record;
    eid uuid;
    who text := (select name from profiles where id = auth.uid());
begin
    select * into p from class_cash_proofs where id = proof_id for update;
    if not found then raise exception 'CASH_PROOF_MISSING'; end if;
    if not public.can_manage_cash(p.class) then raise exception 'NOT_ALLOWED'; end if;
    if p.status <> 'pending' then raise exception 'CASH_PROOF_DONE'; end if;

    if accept then
        -- paid in cash meanwhile? then just link to that entry
        select id into eid from class_cash_entries
        where class = p.class and category = 'dues' and student_id = p.student_id and period_key = p.period_key;
        if eid is null then
            insert into class_cash_entries (class, kind, category, amount, note, student_id, student_name,
                                            period_key, entry_date, created_by, created_by_name)
            values (p.class, 'in', 'dues', p.amount, 'Transfer', p.student_id, p.student_name,
                    p.period_key, (now() at time zone 'Asia/Jakarta')::date, auth.uid(), who)
            returning id into eid;
        end if;
        update class_cash_proofs set status = 'approved', entry_id = eid,
            reviewed_by = auth.uid(), reviewed_by_name = who, reviewed_at = now()
        where id = proof_id;
    else
        update class_cash_proofs set status = 'rejected', reject_reason = nullif(trim(left(reason, 120)), ''),
            reviewed_by = auth.uid(), reviewed_by_name = who, reviewed_at = now()
        where id = proof_id;
    end if;
end $$;
revoke execute on function public.review_cash_proof(uuid, boolean, text) from public, anon;
grant execute on function public.review_cash_proof(uuid, boolean, text) to authenticated;

-- if the treasurer later un-ticks dues that came from a proof, the proof is
-- cancelled so the student can send a new one
create or replace function public.cancel_cash_proof_on_delete()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    update class_cash_proofs set status = 'cancelled' where entry_id = old.id and status = 'approved';
    return old;
end $$;
drop trigger if exists cancel_cash_proof_on_delete on public.class_cash_entries;
create trigger cancel_cash_proof_on_delete before delete on public.class_cash_entries
    for each row execute function public.cancel_cash_proof_on_delete();

-- 4) the proof photo: only that student and whoever manages the class cash
drop policy if exists cash_proofs_photo_select on storage.objects;
create policy cash_proofs_photo_select on storage.objects for select to authenticated
    using (bucket_id = 'cash-receipts' and exists (
        select 1 from public.class_cash_proofs p
        where p.photo_path = storage.objects.name
          and (p.student_id = auth.uid() or public.can_manage_cash(p.class))));
