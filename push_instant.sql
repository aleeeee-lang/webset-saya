-- ============================================================
-- INSTANT PUSH: announcements / attendance reach the phone within seconds
-- ============================================================
-- Run once in Supabase -> SQL Editor, AFTER push_events.sql. Safe to re-run.
-- Before: the 5-minute schedule picked up the waiting list.
-- Now: as soon as something is added to the waiting list, the database calls
-- the sender right away (the 5-minute schedule stays as a safety net).

-- 1) Keep the sender's password in Supabase Vault (copied from the existing
--    5-minute job, so it never has to be typed or stored in a file).
do $$
declare s text;
begin
    select substring(command from '''x-cron-secret'',\s*''([^'']+)''') into s
    from cron.job where jobname = 'attendreem-task-reminders';
    if s is null then raise exception 'Run push_cron.sql first (5-minute job not found)'; end if;
    if exists (select 1 from vault.secrets where name = 'attendreem_cron_secret') then
        perform vault.update_secret((select id from vault.secrets where name = 'attendreem_cron_secret'), s);
    else
        perform vault.create_secret(s, 'attendreem_cron_secret');
    end if;
end $$;

-- 2) Take waiting notifications and mark them sent in one step
--    (two senders running at the same moment never send the same one twice).
create or replace function claim_push_queue(max_rows int default 2000) returns setof push_queue
language sql security definer set search_path = public as $$
    update push_queue set sent_at = now()
    where id in (
        select id from push_queue
        where sent_at is null and created_at > now() - interval '6 hours'
        order by id limit max_rows
        for update skip locked)
    returning *;
$$;
revoke execute on function claim_push_queue(int) from public, anon, authenticated;
grant execute on function claim_push_queue(int) to service_role;

-- 3) New rows in the waiting list -> call the sender now (once per save, not once per person)
create or replace function kick_push_sender() returns trigger
language plpgsql security definer set search_path = public as $$
declare s text;
begin
    begin
        select decrypted_secret into s from vault.decrypted_secrets where name = 'attendreem_cron_secret';
        if s is not null then
            perform net.http_post(
                url := 'https://vqpxumrodadqqaxuyehy.supabase.co/functions/v1/task-reminders',
                headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s),
                body := '{"queue_only": true}'::jsonb);
        end if;
    exception when others then
        raise warning 'kick_push_sender: %', sqlerrm;   -- never block the save; the 5-minute job still sends it
    end;
    return null;
end $$;
drop trigger if exists kick_push_sender on push_queue;
create trigger kick_push_sender after insert on push_queue
    for each statement execute function kick_push_sender();
revoke execute on function kick_push_sender() from public, anon, authenticated;
