-- ============================================================
-- TASKS & DEADLINES
-- ============================================================
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- Purely additive: two new tables, one helper function, RLS policies.
-- Reuses is_admin() and is_teacher_of_class() from earlier migrations.
--
-- tasks       : a personal task (user_id set, class empty) or a task a
--               teacher gives to a whole class (class set, user_id empty).
-- task_done   : who has ticked which task as done.

create table if not exists tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(title) between 1 and 120),
    description text,
    subject text,
    due_at timestamptz not null,
    user_id uuid references profiles(id) on delete cascade,   -- personal task owner
    class text,                                               -- class task target
    created_by uuid not null references profiles(id) on delete cascade,
    school_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint tasks_owner_or_class check ((user_id is not null) <> (class is not null))
);

create index if not exists tasks_user_due_idx on tasks (user_id, due_at);
create index if not exists tasks_class_due_idx on tasks (class, due_at);

create table if not exists task_done (
    task_id uuid not null references tasks(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,
    done_at timestamptz not null default now(),
    primary key (task_id, user_id)
);

-- Same default school as the other tables, if multi-school infra exists.
do $$
declare
    default_school_id uuid;
begin
    if exists (select 1 from information_schema.tables where table_name = 'schools') then
        select id into default_school_id from schools order by created_at asc limit 1;
        if default_school_id is not null then
            execute format('alter table tasks alter column school_id set default %L', default_school_id);
        end if;
    end if;
end $$;

-- The signed-in user's own class (security definer so policies don't recurse).
create or replace function my_class() returns text
language sql stable security definer set search_path = public as $$
    select class from profiles where id = auth.uid()
$$;

alter table tasks enable row level security;
alter table task_done enable row level security;

-- SEE a task: your own, one you created, one given to your class,
-- one given to a class you teach, or anything if you're an admin.
drop policy if exists "tasks_select" on tasks;
create policy "tasks_select" on tasks for select using (
    user_id = auth.uid()
    or created_by = auth.uid()
    or (class is not null and class = my_class())
    or (class is not null and is_teacher_of_class(class))
    or is_admin()
);

-- ADD: a personal task for yourself, or (teachers/admins) a task for a class.
drop policy if exists "tasks_insert" on tasks;
create policy "tasks_insert" on tasks for insert with check (
    created_by = auth.uid() and (
        (user_id = auth.uid() and class is null)
        or (class is not null and (is_teacher_of_class(class) or is_admin()))
    )
);

-- CHANGE / REMOVE: only whoever created it (or an admin).
drop policy if exists "tasks_update" on tasks;
create policy "tasks_update" on tasks for update
    using (created_by = auth.uid() or is_admin())
    with check (created_by = auth.uid() or is_admin());

drop policy if exists "tasks_delete" on tasks;
create policy "tasks_delete" on tasks for delete
    using (created_by = auth.uid() or is_admin());

-- DONE ticks: you tick your own; the task's creator, the class teacher
-- and admins can see who has finished.
drop policy if exists "task_done_select" on task_done;
create policy "task_done_select" on task_done for select using (
    user_id = auth.uid()
    or is_admin()
    or exists (
        select 1 from tasks t
        where t.id = task_done.task_id
          and (t.created_by = auth.uid() or (t.class is not null and is_teacher_of_class(t.class)))
    )
);

drop policy if exists "task_done_insert" on task_done;
create policy "task_done_insert" on task_done for insert with check (user_id = auth.uid());

drop policy if exists "task_done_delete" on task_done;
create policy "task_done_delete" on task_done for delete using (user_id = auth.uid());
