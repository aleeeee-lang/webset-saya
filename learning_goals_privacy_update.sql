-- ============================================================
-- LEARNING GOALS — make private goals truly private (no admin override)
-- ============================================================
-- Run this AFTER learning_goals.sql if you already ran it.
-- Only replaces the SELECT policy — nothing else changes.
-- Also works fine as a no-op re-run if learning_goals.sql hasn't
-- been run yet (it will just create the final version directly).

drop policy if exists "learning_goals_select" on learning_goals;
create policy "learning_goals_select" on learning_goals
    for select
    using (
        user_id = auth.uid()
        or created_by = auth.uid()
        or (is_shared = true and is_teacher_of_class(class))
    );
