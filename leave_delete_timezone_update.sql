-- ============================================================
-- Leave request delete rule: work for WIB, WITA and WIT
-- ============================================================
-- Run this if you ALREADY ran delete_own_submissions.sql.
-- (If you haven't, just run the updated delete_own_submissions.sql.)
-- Replaces the WIB-only date check with Asia/Jayapura (WIT), the
-- earliest Indonesian time zone, so no student is blocked after their
-- own local midnight. The app itself uses each device's local date.

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
