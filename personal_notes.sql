-- ============================================================
-- PERSONAL NOTES ON THE CALENDAR
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- Everyone can tap a date on the calendar and write a short note for
-- themselves ("belajar kelompok", "ulang tahun Rina", ...). A note is
-- private: only its owner can see, add, change or delete it.

create table if not exists public.personal_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
    date date not null,
    title text not null check (char_length(btrim(title)) between 1 and 80),
    created_at timestamptz not null default now()
);
create index if not exists personal_notes_user_date_idx on public.personal_notes (user_id, date);

alter table public.personal_notes enable row level security;
drop policy if exists personal_notes_select on public.personal_notes;
create policy personal_notes_select on public.personal_notes for select to authenticated
    using (user_id = auth.uid());
drop policy if exists personal_notes_insert on public.personal_notes;
create policy personal_notes_insert on public.personal_notes for insert to authenticated
    with check (user_id = auth.uid());
drop policy if exists personal_notes_update on public.personal_notes;
create policy personal_notes_update on public.personal_notes for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists personal_notes_delete on public.personal_notes;
create policy personal_notes_delete on public.personal_notes for delete to authenticated
    using (user_id = auth.uid());

-- at most 10 notes on one day per person (keeps the calendar tidy)
create or replace function public.guard_personal_note()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    new.title := btrim(new.title);
    if (select count(*) from personal_notes where user_id = new.user_id and date = new.date) >= 10 then
        raise exception 'NOTE_LIMIT' using hint = 'At most 10 notes per day';
    end if;
    return new;
end $$;
drop trigger if exists guard_personal_note on public.personal_notes;
create trigger guard_personal_note before insert on public.personal_notes
    for each row execute function public.guard_personal_note();
