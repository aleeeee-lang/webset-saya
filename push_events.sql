-- ============================================================
-- PUSH NOTIFICATIONS FOR ANNOUNCEMENTS AND ATTENDANCE
-- ============================================================
-- Run once in Supabase -> SQL Editor, AFTER lesson_push.sql. Safe to re-run.
-- The same things the in-app bell shows also reach the phone when the app is closed:
--   * a new announcement (to everyone / a class / one student)
--   * attendance recorded or changed by a teacher or admin
-- Nothing here can block saving an announcement or attendance: if queueing fails,
-- the save still goes through (only the phone notification is skipped).

-- 1) One more on/off choice in Settings
alter table notif_prefs add column if not exists general boolean not null default true;

-- 2) Waiting list of phone notifications; the reminder function sends and clears it
create table if not exists push_queue (
    id bigserial primary key,
    user_id uuid not null references profiles(id) on delete cascade,
    title text not null,
    body text not null default '',
    url text not null default 'index.html',
    tag text,
    created_at timestamptz not null default now(),
    sent_at timestamptz
);
create index if not exists push_queue_pending_idx on push_queue (created_at) where sent_at is null;
alter table push_queue enable row level security;   -- only the server function (service role) uses it

-- 3) New announcement -> queue it for everyone it is meant for (only people with notifications on)
create or replace function queue_broadcast_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    begin
        insert into push_queue (user_id, title, body, url, tag)
        select distinct ps.user_id, '📢 Pengumuman', left(coalesce(new.message, ''), 180), 'index.html', 'broadcast-' || new.id
        from push_subscriptions ps
        join profiles p on p.id = ps.user_id
        where ps.user_id is distinct from new.created_by
          and (new.target_type = 'all'
               or (new.target_type = 'class' and p.class = new.target_value)
               or (new.target_type = 'student' and p.id::text = new.target_value));
    exception when others then
        raise warning 'queue_broadcast_push: %', sqlerrm;
    end;
    return new;
end $$;
drop trigger if exists queue_broadcast_push on broadcasts;
create trigger queue_broadcast_push after insert on broadcasts
    for each row execute function queue_broadcast_push();

-- 4) Attendance saved by someone else (teacher / admin) -> tell the student
create or replace function queue_attendance_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    label text;
begin
    begin
        if new.user_id is null or auth.uid() is not distinct from new.user_id then return new; end if;   -- own check-in: no need
        if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
        if not exists (select 1 from push_subscriptions where user_id = new.user_id) then return new; end if;
        label := case new.status when 'Hadir' then 'Hadir' when 'Izin' then 'Izin' when 'Sakit' then 'Sakit' when 'Alpa' then 'Alpa' else coalesce(new.status, '-') end;
        insert into push_queue (user_id, title, body, url, tag)
        values (new.user_id,
                case when tg_op = 'UPDATE' then 'Absensimu diperbarui' else 'Absensimu tercatat' end,
                label || ' · ' || to_char(new.date, 'DD/MM/YYYY'),
                'my-attendance.html',
                'attendance-' || new.id);
    exception when others then
        raise warning 'queue_attendance_push: %', sqlerrm;
    end;
    return new;
end $$;
drop trigger if exists queue_attendance_push on attendance;
create trigger queue_attendance_push after insert or update of status on attendance
    for each row execute function queue_attendance_push();

-- these run only as triggers
revoke execute on function queue_broadcast_push() from public, anon, authenticated;
revoke execute on function queue_attendance_push() from public, anon, authenticated;
