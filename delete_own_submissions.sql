-- ============================================================
-- Let users delete their own submissions (trash buttons)
-- ============================================================
-- Run in Supabase SQL Editor. Purely additive: only adds new DELETE
-- policies; existing policies (incl. admin delete) are untouched.

-- Students can delete their own feedback / suggestions.
drop policy if exists "feedback_delete_own" on feedback;
create policy "feedback_delete_own" on feedback
    for delete
    using (student_id = auth.uid());

-- Students can delete their own leave request:
--   - pending or rejected: any time
--   - approved: only after the leave period has ended. The app shows
--     the trash icon based on the device's own local date; the check
--     here uses Asia/Jayapura (WIT, Indonesia's earliest time zone) so
--     students in WIB, WITA or WIT are never blocked after their own
--     local midnight,
--     so the list doesn't pile up. The attendance rows the approval
--     created are NOT touched and stay in the calendar/records.
drop policy if exists "leave_requests_delete_own_pending" on leave_requests;
drop policy if exists "leave_requests_delete_own" on leave_requests;
create policy "leave_requests_delete_own" on leave_requests
    for delete
    using (
        user_id = auth.uid()
        and (
            status in ('pending', 'rejected')
            or (status = 'approved'
                and coalesce(end_date, start_date) < (now() at time zone 'Asia/Jayapura')::date)
        )
    );

-- learning_goals already allows delete by owner or creator
-- (learning_goals.sql), so teachers can delete goals they assigned.
