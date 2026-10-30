-- One phone = one student account (stops "titip absen" by registering a friend's phone).
--
-- The app keeps a random id for the phone (browser) and sends it with every check-in.
-- The first student to check in from a phone owns it; another account checking in from
-- that same phone is refused with ATT_DEVICE_IN_USE. When the admin resets a student's
-- fingerprint phone (Data siswa -> reset), that student's phones are released too.
-- Teacher / admin check-ins for a student are not affected.
-- Safe to run again.

alter table public.attendance add column if not exists device_id text;

create table if not exists public.attendance_devices (
    device_id   text primary key,
    user_id     uuid not null references auth.users(id) on delete cascade,
    created_at  timestamptz not null default now(),
    last_used_at timestamptz not null default now()
);
alter table public.attendance_devices enable row level security;   -- no policies: only the trigger below touches it

create or replace function public.zzz_attendance_device()
returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
    -- only a student checking in for themselves, from a phone the app identified
    if new.device_id is null or auth.uid() is null or auth.uid() <> new.user_id then return new; end if;
    if length(new.device_id) > 100 then raise exception 'ATT_DEVICE_INVALID'; end if;
    select user_id into owner from attendance_devices where device_id = new.device_id;
    if owner is not null and owner <> new.user_id then
        raise exception 'ATT_DEVICE_IN_USE';
    end if;
    insert into attendance_devices (device_id, user_id) values (new.device_id, new.user_id)
        on conflict (device_id) do update set last_used_at = now();
    return new;
end;
$$;

drop trigger if exists zzz_attendance_device on public.attendance;
create trigger zzz_attendance_device before insert on public.attendance
    for each row execute function public.zzz_attendance_device();

-- admin resets the fingerprint phone -> the student's phones are free again
create or replace function public.release_attendance_devices()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    delete from attendance_devices where user_id = old.user_id;
    return old;
end;
$$;

drop trigger if exists release_attendance_devices on public.webauthn_credentials;
create trigger release_attendance_devices after delete on public.webauthn_credentials
    for each row execute function public.release_attendance_devices();


-- Homeroom / subject teachers can open their students' check-in photos (and letters)
-- - the same students whose attendance they can already read. Classmates still can't.
drop policy if exists attendance_photos_select_teacher on storage.objects;
create policy attendance_photos_select_teacher on storage.objects
    for select to authenticated
    using (
        bucket_id = 'attendance-photos'
        and exists (
            select 1 from public.attendance a
            join public.profiles p on p.id = a.user_id
            where (a.photo_url = storage.objects.name or a.checkout_photo_url = storage.objects.name or a.proof_url = storage.objects.name)
              and p.role = 'murid'
              and public.is_teacher_of_class(p.class)
        )
    );
