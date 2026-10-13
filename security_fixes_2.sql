-- ============================================================
-- SECURITY FIXES 2 (applied 2026-10-13 via the Supabase connector)
-- ============================================================

-- 1) Attendance face photos: no access without login; only admins (and,
--    for new photos stored in a per-student folder, the student) can view.
drop policy if exists "Allow attendance photo upload 1pmm411_0" on storage.objects;
drop policy if exists "Allow attendance photo view 1pmm411_0" on storage.objects;
drop policy if exists "auth select attendance-photos" on storage.objects;
drop policy if exists "attendance_photos_select_admin_or_owner" on storage.objects;
create policy "attendance_photos_select_admin_or_owner" on storage.objects
    for select to authenticated
    using (bucket_id = 'attendance-photos'
           and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text));

-- 2) Teachers can give tasks to (and follow) every class they teach in the
--    lesson schedule, not only their homeroom class. Grades, attendance and
--    SPP access stay homeroom-only.
create or replace function public.is_teaching_class(target_class text) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from profiles where id = auth.uid() and role = 'guru' and class = target_class)
        or exists (select 1 from class_schedules cs join profiles p on p.id = auth.uid() and p.role = 'guru'
                   where cs.teacher_id = auth.uid() and cs.class = target_class);
$$;

drop policy if exists "tasks_select" on tasks;
create policy "tasks_select" on tasks for select using (
    user_id = auth.uid() or created_by = auth.uid()
    or (class is not null and class = my_class())
    or (class is not null and is_teaching_class(class))
    or is_admin()
);
drop policy if exists "tasks_insert" on tasks;
create policy "tasks_insert" on tasks for insert with check (
    created_by = auth.uid() and (
        (user_id = auth.uid() and class is null)
        or (class is not null and (is_teaching_class(class) or is_admin()))
    )
);
drop policy if exists "task_done_select" on task_done;
create policy "task_done_select" on task_done for select using (
    user_id = auth.uid() or is_admin()
    or exists (select 1 from tasks t where t.id = task_done.task_id
               and (t.created_by = auth.uid() or (t.class is not null and is_teaching_class(t.class))))
);
-- teachers can see the student list (names) of classes they teach
drop policy if exists "profiles_select_teaching" on profiles;
create policy "profiles_select_teaching" on profiles for select using (role = 'murid' and is_teaching_class(class));

-- 3) Housekeeping suggested by the Supabase security advisor
alter function public.is_teacher_of_class(text) set search_path = public;
alter function public.is_parent_of_student(uuid) set search_path = public;
revoke execute on function public.guard_profile_changes() from public, anon, authenticated;
revoke execute on function public.guard_self_attendance() from public, anon, authenticated;
revoke execute on function public.log_profiles_change() from public, anon, authenticated;
revoke execute on function public.log_spp_payments_status_change() from public, anon, authenticated;
revoke execute on function public.log_student_grades_change() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
