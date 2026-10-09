-- ============================================================
-- LEARNING GOALS (student weekly / monthly / yearly targets)
-- ============================================================
-- Run this in Supabase SQL Editor. Purely additive: new table +
-- new RLS policies only. Reuses is_teacher_of_class() and is_admin()
-- which were created by teacher_portal.sql / earlier migrations.

create table if not exists learning_goals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references profiles(id) on delete cascade,
    name text,
    class text,
    period text not null check (period in ('weekly', 'monthly', 'yearly')),
    title text not null,
    description text,
    target_date date,
    status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'achieved')),
    progress_percent int not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
    is_shared boolean not null default false,
    created_by uuid references profiles(id),
    school_id uuid references schools(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Set school_id default to the existing default school, if the
-- multi-school infra (school_id_infrastructure.sql) was applied.
do $$
declare
    default_school_id uuid;
begin
    if exists (select 1 from information_schema.tables where table_name = 'schools') then
        select id into default_school_id from schools order by created_at asc limit 1;
        if default_school_id is not null then
            execute format('alter table learning_goals alter column school_id set default %L', default_school_id);
        end if;
    end if;
end $$;

alter table learning_goals enable row level security;

-- SELECT: the owner always sees their own goals (this works for
-- students AND teachers creating personal goals for themselves);
-- whoever created a goal (e.g. a teacher who assigned it to a
-- student) always sees it; a teacher of the owner's class sees it
-- only if the owner marked it "shared". Deliberately NOT including
-- is_admin() here: a goal left private is private from admins too.
drop policy if exists "learning_goals_select" on learning_goals;
create policy "learning_goals_select" on learning_goals
    for select
    using (
        user_id = auth.uid()
        or created_by = auth.uid()
        or (is_shared = true and is_teacher_of_class(class))
    );

-- INSERT: a student can create their own goal; a teacher can create a
-- goal for a student in their own class (and must set created_by to
-- themselves).
drop policy if exists "learning_goals_insert" on learning_goals;
create policy "learning_goals_insert" on learning_goals
    for insert
    with check (
        user_id = auth.uid()
        or (created_by = auth.uid() and is_teacher_of_class(class))
    );

-- UPDATE / DELETE: the student who owns the goal, or whoever created
-- it, can edit/remove it.
drop policy if exists "learning_goals_update" on learning_goals;
create policy "learning_goals_update" on learning_goals
    for update
    using (user_id = auth.uid() or created_by = auth.uid());

drop policy if exists "learning_goals_delete" on learning_goals;
create policy "learning_goals_delete" on learning_goals
    for delete
    using (user_id = auth.uid() or created_by = auth.uid());

create index if not exists idx_learning_goals_user on learning_goals(user_id);
create index if not exists idx_learning_goals_class on learning_goals(class);
