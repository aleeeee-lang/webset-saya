-- ============================================================
-- CHECK-IN WITH A PERSONAL QR SENT BY THE TEACHER
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- An admin or teacher opens "Kirim QR absen" (qr-send.html), picks a class and how
-- long it stays open, and presses Send. Every student of that class gets their OWN
-- QR (a notification + the QR tab on the check-in page). The student opens it; the
-- app reads it, checks the location, takes a quick front-camera photo and sends
-- the check-in as "Hadir".
--   * each QR belongs to one student: someone else's QR is refused;
--   * it works once, and disappears when the time set by the teacher is over;
--   * it only works INSIDE the school area (the point set in Kelola Jadwal),
--     even when the general location check is switched off;
--   * the usual checks still apply: photo, check-in hours, one check-in a day.

-- the earlier draft (one QR on a screen) is not used
drop trigger if exists zz_attendance_qr on public.attendance;
drop function if exists public.zz_attendance_qr();
drop function if exists public.qr_new(text);
drop table if exists public.qr_codes;

create table if not exists public.qr_passes (
    id uuid primary key default gen_random_uuid(),
    batch_id uuid not null,
    user_id uuid not null references profiles(id) on delete cascade,
    class text,
    code text not null unique,
    sent_by uuid references profiles(id) on delete set null,
    sent_by_name text,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists qr_passes_user_idx on public.qr_passes (user_id, expires_at);
create index if not exists qr_passes_batch_idx on public.qr_passes (batch_id);
alter table public.qr_passes enable row level security;
-- a student sees only their own QR, and only while it still works
drop policy if exists qr_passes_select_own on public.qr_passes;
create policy qr_passes_select_own on public.qr_passes for select to authenticated
    using (user_id = auth.uid() and used_at is null and expires_at > now());

alter table public.attendance add column if not exists qr_code text;

-- send: one QR for every student of the class, open for `minutes` (5 to 240)
create or replace function public.qr_send(target_class text, minutes int)
returns json
language plpgsql security definer set search_path = public as $$
declare
    b uuid := gen_random_uuid();
    exp timestamptz := now() + make_interval(mins => greatest(5, least(240, coalesce(minutes, 15))));
    who text := (select name from profiles where id = auth.uid());
    n int;
begin
    if auth.uid() is null or target_class is null or btrim(target_class) = ''
       or not (public.is_admin() or public.is_teaching_class(target_class)) then
        raise exception 'NOT_ALLOWED';
    end if;
    delete from qr_passes where expires_at < now() - interval '2 days';
    -- a new send replaces the QRs of this class that are still open
    delete from qr_passes where class = target_class and used_at is null and expires_at > now();
    insert into qr_passes (batch_id, user_id, class, code, sent_by, sent_by_name, expires_at)
    select b, p.id, p.class, replace(gen_random_uuid()::text, '-', ''), auth.uid(), who, exp
    from profiles p
    where p.role = 'murid' and p.class = target_class and coalesce(p.status, 'active') <> 'inactive';
    get diagnostics n = row_count;
    -- a phone notification for each of them
    insert into push_queue (user_id, title, body, url, tag)
    select q.user_id, '📲 QR absen dari ' || coalesce(who, 'guru'),
           'Buka untuk absen. Berlaku sampai ' || to_char(exp at time zone public.school_tz(), 'HH24.MI') || ', hanya di area sekolah.',
           'attendance.html#qr', 'qr-' || b
    from qr_passes q where q.batch_id = b;
    return json_build_object('batch_id', b, 'count', n, 'expires_at', exp);
end $$;
grant execute on function public.qr_send(text, int) to authenticated;

-- for the teacher's page: who of this send has checked in already
create or replace function public.qr_send_status(batch uuid)
returns table (user_id uuid, name text, used_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
    select q.user_id, p.name, q.used_at, q.expires_at
    from qr_passes q join profiles p on p.id = q.user_id
    where q.batch_id = batch
      and (public.is_admin() or public.is_teaching_class(q.class))
    order by p.name
$$;
grant execute on function public.qr_send_status(uuid) to authenticated;

-- stop early (before the time runs out)
create or replace function public.qr_close(batch uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
    update qr_passes q set expires_at = now()
    where q.batch_id = batch and q.used_at is null and q.expires_at > now()
      and (public.is_admin() or public.is_teaching_class(q.class));
end $$;
grant execute on function public.qr_close(uuid) to authenticated;

-- runs after the other attendance checks (the name starts with "zz" on purpose)
create or replace function public.zz_attendance_qr()
returns trigger
language plpgsql security definer set search_path = public as $$
declare q record; loc record; dist double precision;
begin
    if new.qr_code is null then return new; end if;
    if auth.uid() is not null and not public.is_admin() and new.user_id = auth.uid() then
        if new.status is distinct from 'Hadir' then
            raise exception 'ATT_QR_INVALID' using hint = 'The QR is only for Hadir';
        end if;
        select * into q from qr_passes where code = new.qr_code for update;
        if not found or q.user_id <> auth.uid() then
            raise exception 'ATT_QR_INVALID' using hint = 'This QR is not yours';
        end if;
        if q.used_at is not null or q.expires_at <= now() then
            raise exception 'ATT_QR_EXPIRED' using hint = 'The QR has expired';
        end if;
        -- only inside the school area
        select * into loc from school_location where id = 'default';
        if not found or loc.lat is null or loc.lng is null then
            raise exception 'ATT_QR_NO_SCHOOL' using hint = 'The school location is not set yet';
        end if;
        if new.lat is null or new.lng is null then
            raise exception 'ATT_NO_LOCATION' using hint = 'Turn on location to check in';
        end if;
        if new.accuracy_m is null or new.accuracy_m > 300 then
            raise exception 'ATT_LOCATION_WEAK' using hint = 'Location is not accurate enough';
        end if;
        dist := public.geo_distance_m(loc.lat, loc.lng, new.lat, new.lng);
        if dist > loc.radius_m + least(new.accuracy_m, 50) then
            raise exception 'ATT_TOO_FAR' using hint = 'You are outside the school area';
        end if;
        new.distance_m := round(dist)::int;
        update qr_passes set used_at = now() where id = q.id;
        new.method := 'qr';
    end if;
    new.qr_code := null;
    return new;
end $$;
drop trigger if exists zz_attendance_qr on public.attendance;
create trigger zz_attendance_qr before insert on public.attendance
    for each row execute function public.zz_attendance_qr();
