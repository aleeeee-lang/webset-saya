-- ============================================================
-- CLASS SCHEDULES (weekly lesson timetable per class)
-- ============================================================
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- Purely additive: one new table + its RLS policies.
-- Reuses is_admin() created by earlier migrations.

create table if not exists class_schedules (
    id uuid primary key default gen_random_uuid(),
    class text not null,
    day smallint not null check (day between 1 and 7),      -- 1 = Monday ... 7 = Sunday
    start_time time not null,
    end_time time not null,
    subject text not null,
    room text,
    teacher_id uuid references profiles(id) on delete set null,
    teacher_name text,
    created_by uuid references profiles(id),
    school_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint class_schedules_time_order check (end_time > start_time)
);

create index if not exists class_schedules_class_day_idx on class_schedules (class, day, start_time);
create index if not exists class_schedules_teacher_idx on class_schedules (teacher_id, day, start_time);

-- Same default school as the other tables, if multi-school infra exists.
do $$
declare
    default_school_id uuid;
begin
    if exists (select 1 from information_schema.tables where table_name = 'schools') then
        select id into default_school_id from schools order by created_at asc limit 1;
        if default_school_id is not null then
            execute format('alter table class_schedules alter column school_id set default %L', default_school_id);
        end if;
    end if;
end $$;

alter table class_schedules enable row level security;

-- Anyone signed in can read the timetable (students, teachers, parents).
drop policy if exists "class_schedules_select" on class_schedules;
create policy "class_schedules_select" on class_schedules
    for select
    using (auth.uid() is not null);

-- Only admins can add, change or remove lessons.
drop policy if exists "class_schedules_insert" on class_schedules;
create policy "class_schedules_insert" on class_schedules
    for insert
    with check (is_admin());

drop policy if exists "class_schedules_update" on class_schedules;
create policy "class_schedules_update" on class_schedules
    for update
    using (is_admin())
    with check (is_admin());

drop policy if exists "class_schedules_delete" on class_schedules;
create policy "class_schedules_delete" on class_schedules
    for delete
    using (is_admin());
