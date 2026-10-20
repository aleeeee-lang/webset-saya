-- ============================================================
-- PROOF PHOTO FOR IZIN / SAKIT (doctor's note, letter, ...)
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- A student who checks in as Izin or Sakit can add a photo of a letter
-- (surat dokter, surat izin orang tua). It is kept in the same private
-- bucket as the check-in photos ("attendance-photos"), in the student's
-- own folder, so only the student and admins can open it.

alter table public.attendance add column if not exists proof_url text;

create or replace function public.guard_attendance_proof()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.proof_url is null then return new; end if;
    -- only for Izin / Sakit
    if new.status not in ('Izin', 'Sakit') then
        new.proof_url := null;
        return new;
    end if;
    -- a student may only attach a file from their own folder
    if auth.uid() is not null and not public.is_admin()
       and split_part(new.proof_url, '/', 1) <> new.user_id::text then
        raise exception 'ATT_PROOF_INVALID' using hint = 'The proof photo must be your own upload';
    end if;
    return new;
end $$;
drop trigger if exists guard_attendance_proof on public.attendance;
create trigger guard_attendance_proof before insert or update of proof_url, status on public.attendance
    for each row execute function public.guard_attendance_proof();

-- ------------------------------------------------------------
-- The same for leave requests (Ajukan izin) ---------------------
-- When the admin approves, the photo is copied onto the attendance days.
alter table public.leave_requests add column if not exists proof_url text;

create or replace function public.guard_leave_proof()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.proof_url is null then return new; end if;
    if auth.uid() is not null and not public.is_admin()
       and split_part(new.proof_url, '/', 1) <> new.user_id::text then
        raise exception 'ATT_PROOF_INVALID' using hint = 'The proof photo must be your own upload';
    end if;
    return new;
end $$;
drop trigger if exists guard_leave_proof on public.leave_requests;
create trigger guard_leave_proof before insert or update of proof_url on public.leave_requests
    for each row execute function public.guard_leave_proof();
