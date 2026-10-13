-- ============================================================
-- PUSH NOTIFICATIONS (phone / laptop notifications for tasks)
-- ============================================================
-- Run once in Supabase -> SQL Editor, AFTER tasks.sql. Safe to re-run.

-- One row per device that turned notifications on.
create table if not exists push_subscriptions (
    endpoint text primary key,
    user_id uuid not null references profiles(id) on delete cascade,
    p256dh text not null,
    auth text not null,
    user_agent text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "push_sub_select" on push_subscriptions;
create policy "push_sub_select" on push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "push_sub_insert" on push_subscriptions;
create policy "push_sub_insert" on push_subscriptions for insert with check (user_id = auth.uid());
drop policy if exists "push_sub_update" on push_subscriptions;
create policy "push_sub_update" on push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Save (or move) this device's subscription to whoever is signed in now.
-- Needed when two people use the same phone/browser one after another.
create or replace function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then raise exception 'not signed in'; end if;
    insert into push_subscriptions (endpoint, user_id, p256dh, auth, user_agent, updated_at)
    values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_ua, 200), now())
    on conflict (endpoint) do update
        set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
            user_agent = excluded.user_agent, updated_at = now();
end $$;
grant execute on function save_push_subscription(text, text, text, text) to authenticated;
drop policy if exists "push_sub_delete" on push_subscriptions;
create policy "push_sub_delete" on push_subscriptions for delete using (user_id = auth.uid());

-- Remembers which reminder was already sent, so nobody gets the same one twice.
create table if not exists task_push_log (
    task_id uuid not null references tasks(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,
    stage text not null,               -- new | h1 | h0 | soon
    sent_at timestamptz not null default now(),
    primary key (task_id, user_id, stage)
);
alter table task_push_log enable row level security;   -- only the server function (service role) uses it
