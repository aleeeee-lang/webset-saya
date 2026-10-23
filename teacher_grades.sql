-- ============================================================
-- TEACHERS: GRADES FOR EVERY CLASS THEY TEACH + FIX THEIR OWN ENTRIES
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- Before: only the homeroom teacher could add grades, only for their own class, and
-- they could change any grade of that class (also other teachers') but delete none.
-- Now:
--   * a teacher can add grades for students of every class they teach: the class they
--     lead, plus the classes they have in the lesson schedule (is_teaching_class);
--   * a teacher sees the grades of those students (for the "up / down" arrows);
--   * a teacher can change or delete only the grades THEY entered (created_by);
--   * the admin can still do everything.

-- add
drop policy if exists student_grades_insert_teacher on public.student_grades;
create policy student_grades_insert_teacher on public.student_grades for insert to authenticated
    with check (created_by = auth.uid()
                and exists (select 1 from profiles p
                            where p.id = student_grades.user_id and p.role = 'murid' and public.is_teaching_class(p.class)));

-- read
drop policy if exists student_grades_select_teacher on public.student_grades;
create policy student_grades_select_teacher on public.student_grades for select to authenticated
    using (created_by = auth.uid()
           or exists (select 1 from profiles p
                      where p.id = student_grades.user_id and p.role = 'murid' and public.is_teaching_class(p.class)));

-- change: only their own entries, and it stays their own entry for a student they teach
drop policy if exists student_grades_update_teacher on public.student_grades;
create policy student_grades_update_teacher on public.student_grades for update to authenticated
    using (created_by = auth.uid())
    with check (created_by = auth.uid()
                and exists (select 1 from profiles p
                            where p.id = student_grades.user_id and p.role = 'murid' and public.is_teaching_class(p.class)));

-- delete: only their own entries
drop policy if exists student_grades_delete_teacher on public.student_grades;
create policy student_grades_delete_teacher on public.student_grades for delete to authenticated
    using (created_by = auth.uid()
           and exists (select 1 from profiles where id = auth.uid() and role = 'guru'));
