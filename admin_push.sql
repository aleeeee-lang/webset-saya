-- ============================================================
-- ADMIN PUSH NOTIFICATIONS, SPLIT BY DIVISION
-- ============================================================
-- Run in Supabase -> SQL Editor, AFTER push_events.sql. Safe to re-run.
--
-- Admins hear about new things that wait for them, right away:
--   * Izin          a student sends a leave request          -> admin-leave.html
--   * Saran/Keluhan a student sends a suggestion or complaint -> admin-feedback.html
--   * SPP           a student / parent sends a payment proof  -> admin-spp.html
-- Each admin turns each division on or off in Settings (notif_prefs).
-- Only admins who turned phone notifications on (push_subscriptions) get them.
-- Nothing here can block saving: if queueing fails, the save still goes through.

-- 1) one on/off choice per division
alter table notif_prefs add column if not exists admin_leave boolean not null default true;
alter table notif_prefs add column if not exists admin_feedback boolean not null default true;
alter table notif_prefs add column if not exists admin_spp boolean not null default true;

-- 2) queue one push for every admin who wants this division
create or replace function queue_admin_push(division text, p_title text, p_body text, p_url text, p_tag text, skip_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
    insert into push_queue (user_id, title, body, url, tag)
    select distinct p.id, p_title, left(coalesce(p_body, ''), 180), p_url, p_tag
    from profiles p
    join push_subscriptions ps on ps.user_id = p.id
    left join notif_prefs np on np.user_id = p.id
    where p.role = 'admin'
      and p.id is distinct from skip_user
      and case division
            when 'leave'    then coalesce(np.admin_leave, true)
            when 'feedback' then coalesce(np.admin_feedback, true)
            when 'spp'      then coalesce(np.admin_spp, true)
            else false end;
end $$;

-- 3) Izin: new leave request
create or replace function queue_admin_leave_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    who text;
    span text;
begin
    begin
        who := coalesce(nullif(trim(new.name), ''), (select name from profiles where id = new.user_id), 'Siswa');
        span := case when new.end_date is null or new.end_date = new.start_date
                     then to_char(new.start_date, 'DD/MM')
                     else to_char(new.start_date, 'DD/MM') || '–' || to_char(new.end_date, 'DD/MM') end;
        perform queue_admin_push('leave',
            '📝 Izin · Pengajuan baru',
            who || coalesce(' (' || nullif(new.class, '') || ')', '') || ' · ' || coalesce(new.type, 'Izin') || ' ' || coalesce(span, '')
                || coalesce(' — ' || nullif(trim(new.reason), ''), ''),
            'admin-leave.html', 'admin-leave-' || new.id, new.user_id);
    exception when others then
        raise warning 'queue_admin_leave_push: %', sqlerrm;
    end;
    return new;
end $$;
drop trigger if exists queue_admin_leave_push on leave_requests;
create trigger queue_admin_leave_push after insert on leave_requests
    for each row execute function queue_admin_leave_push();

-- 4) Saran / Keluhan: new feedback
create or replace function queue_admin_feedback_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    is_complaint boolean := lower(coalesce(new.category, '')) in ('keluhan', 'complaint');
begin
    begin
        perform queue_admin_push('feedback',
            case when is_complaint then '⚠️ Keluhan baru' else '💡 Saran baru' end,
            coalesce(nullif(trim(new.student_name), ''), 'Siswa') || coalesce(' (' || nullif(new.class, '') || ')', '')
                || ' · ' || coalesce(new.message, ''),
            'admin-feedback.html', 'admin-feedback-' || new.id, new.student_id);
    exception when others then
        raise warning 'queue_admin_feedback_push: %', sqlerrm;
    end;
    return new;
end $$;
drop trigger if exists queue_admin_feedback_push on feedback;
create trigger queue_admin_feedback_push after insert on feedback
    for each row execute function queue_admin_feedback_push();

-- 5) SPP: a proof is sent (first time, or again after a rejection)
create or replace function queue_admin_spp_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    s record;
begin
    begin
        if new.status is distinct from 'pending' or new.proof_url is null then return new; end if;
        if tg_op = 'UPDATE' and old.status is not distinct from 'pending'
           and old.proof_url is not distinct from new.proof_url then return new; end if;   -- nothing new to check
        select name, class into s from profiles where id = new.user_id;
        perform queue_admin_push('spp',
            '💳 SPP · Bukti bayar baru',
            coalesce(s.name, 'Siswa') || coalesce(' (' || nullif(s.class, '') || ')', '') || ' · ' || coalesce(new.period, '')
                || case when coalesce(new.amount, 0) > 0
                        then ' · Rp ' || replace(to_char(new.amount, 'FM999G999G999'), ',', '.') else '' end,
            'admin-spp.html', 'admin-spp-' || new.id, null);
    exception when others then
        raise warning 'queue_admin_spp_push: %', sqlerrm;
    end;
    return new;
end $$;
drop trigger if exists queue_admin_spp_push on spp_payments;
create trigger queue_admin_spp_push after insert or update of status, proof_url on spp_payments
    for each row execute function queue_admin_spp_push();

-- these run only from the triggers above
revoke execute on function queue_admin_push(text, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function queue_admin_leave_push() from public, anon, authenticated;
revoke execute on function queue_admin_feedback_push() from public, anon, authenticated;
revoke execute on function queue_admin_spp_push() from public, anon, authenticated;
