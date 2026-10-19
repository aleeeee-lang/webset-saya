-- ============================================================
-- TASKS: photo of the work, trash buttons, hand-in time from the server
-- ============================================================
-- Run in Supabase -> SQL Editor. Safe to re-run.
--
-- 1) photo_paths: a class task can only be handed in with photos of the work
--    (1 to 10 photos, private bucket task-photos, folder = the student's id).
--    The student, the teacher of that class and admins can open them.
--    Once handed in it is final: no photos can be added, swapped or removed,
--    and the student can't un-tick it.
-- 2) hidden_at: a student can put a finished task in the trash. It disappears
--    from their own list only; the teacher still sees the hand-in and photo.
-- 3) archived_at: a teacher can put a task whose deadline has passed in the
--    trash. It leaves the teacher's own list; nothing is deleted.
-- 4) the hand-in time (done_at) is always the server's clock and can never be
--    changed afterwards, so nobody can fake an on-time hand-in.

alter table public.task_done add column if not exists hidden_at timestamptz;
alter table public.task_done add column if not exists photo_paths text[];
alter table public.tasks add column if not exists archived_at timestamptz;

-- a student may update only their own row (the trigger lets them change nothing but hidden_at)
drop policy if exists task_done_update on public.task_done;
create policy task_done_update on public.task_done for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.guard_task_done()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if tg_op = 'INSERT' then
        new.done_at := now();          -- hand-in time = server time
        new.hidden_at := null;
        if auth.uid() is not null and not public.is_admin() then
            -- a class task needs 1-10 photos, all uploaded into the student's own folder
            if exists (select 1 from tasks where id = new.task_id and class is not null) then
                if coalesce(array_length(new.photo_paths, 1), 0) = 0
                   or array_length(new.photo_paths, 1) > 10
                   or exists (select 1 from unnest(new.photo_paths) p where split_part(p, '/', 1) <> auth.uid()::text) then
                    raise exception 'TASK_PHOTO_REQUIRED' using hint = 'Add photos of your work';
                end if;
            end if;
        end if;
        return new;
    end if;
    -- UPDATE: only the trash flag may change
    new.task_id := old.task_id;
    new.user_id := old.user_id;
    new.done_at := old.done_at;
    new.photo_paths := old.photo_paths;
    return new;
end $$;

-- a handed-in class task is final: the student can't un-tick it (personal tasks still can)
drop policy if exists task_done_delete on public.task_done;
create policy task_done_delete on public.task_done for delete to authenticated
    using (user_id = auth.uid()
           and not exists (select 1 from public.tasks t where t.id = task_done.task_id and t.class is not null));

drop trigger if exists guard_task_done on public.task_done;
create trigger guard_task_done before insert or update on public.task_done
    for each row execute function public.guard_task_done();

-- photos: private bucket, path = <student id>/<task id>/<time>.jpg
insert into storage.buckets (id, name, public) values ('task-photos', 'task-photos', false)
on conflict (id) do nothing;

drop policy if exists task_photos_insert on storage.objects;
create policy task_photos_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'task-photos' and (storage.foldername(name))[1] = auth.uid()::text
        -- no more uploads once the task has been handed in
        and not exists (select 1 from public.task_done d
                        where d.user_id = auth.uid() and d.task_id::text = (storage.foldername(name))[2]));

drop policy if exists task_photos_select on storage.objects;
create policy task_photos_select on storage.objects for select to authenticated
    using (bucket_id = 'task-photos' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.is_admin()
        or exists (select 1 from public.tasks t
                   where t.id::text = (storage.foldername(name))[2]
                     and (t.created_by = auth.uid() or (t.class is not null and public.is_teaching_class(t.class))))
    ));

drop policy if exists task_photos_delete on storage.objects;
create policy task_photos_delete on storage.objects for delete to authenticated
    using (bucket_id = 'task-photos' and (storage.foldername(name))[1] = auth.uid()::text
        -- photos of a handed-in task can't be removed either
        and not exists (select 1 from public.task_done d
                        where d.user_id = auth.uid() and d.task_id::text = (storage.foldername(name))[2]));
