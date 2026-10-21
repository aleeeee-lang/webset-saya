-- ============================================================
-- A CHECK-IN NEEDS A FRESH PHOTO (camera or fingerprint)
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- Until now the app asked for a photo, but the server also accepted a
-- check-in without one. Now every check-in a student sends for themselves
-- (Hadir, Izin, Sakit, Alpa) must come with the photo taken on the
-- check-in page just before:
--   * it is in the student's own folder, named like the check-in page names it
--     (not a letter photo "proof_..." / "leave_..." or a phone-change photo);
--   * the file really exists in the "attendance-photos" bucket;
--   * it was uploaded in the last 10 minutes (an old photo can't be reused);
--   * it isn't already used by another check-in.
-- Admins and teachers filling in for a student are not affected.

create or replace function public.guard_attendance_photo()
returns trigger
language plpgsql security definer set search_path = public, storage as $$
begin
    if auth.uid() is null or public.is_admin() then return new; end if;
    if new.user_id is distinct from auth.uid() then return new; end if;   -- teacher filling in

    if new.photo_url is null
       or new.photo_url !~ ('^' || auth.uid()::text || '/[0-9]+\.jpg$') then
        raise exception 'ATT_PHOTO_NEEDED' using hint = 'Take a photo (or scan your fingerprint) first';
    end if;
    if not exists (select 1 from storage.objects o
                   where o.bucket_id = 'attendance-photos' and o.name = new.photo_url
                     and o.created_at > now() - interval '10 minutes') then
        raise exception 'ATT_PHOTO_NEEDED' using hint = 'The photo is missing or too old, take it again';
    end if;
    if exists (select 1 from attendance a where a.photo_url = new.photo_url) then
        raise exception 'ATT_PHOTO_NEEDED' using hint = 'This photo was already used';
    end if;
    return new;
end $$;
drop trigger if exists guard_attendance_photo on public.attendance;
create trigger guard_attendance_photo before insert on public.attendance
    for each row execute function public.guard_attendance_photo();

-- uploads into the bucket only into your own folder (it allowed any folder before)
drop policy if exists "auth insert attendance-photos" on storage.objects;
drop policy if exists attendance_photos_insert_own on storage.objects;
create policy attendance_photos_insert_own on storage.objects for insert to authenticated
    with check (bucket_id = 'attendance-photos'
                and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text));
