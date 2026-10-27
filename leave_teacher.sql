-- leave_teacher.sql
-- Izin / Sakit requests also go to the class teachers, who may approve or reject them.
--   * a teacher sees the requests of the students in a class they lead or teach
--     (is_teaching_class: homeroom teacher, or a teacher in class_schedules)
--   * they see the letter photo too
--   * approving / rejecting goes through review_leave(): one step, the same rules for
--     teacher and admin, and the attendance days are written by the server
--   * a new request sends a push to those teachers; a rejection sends one to the student
-- Safe to run more than once.

-- who reviewed it (shown to the student: "Disetujui oleh Bu Sari")
alter table public.leave_requests add column if not exists reviewed_by_name text;

-- may the signed-in person review this student's requests?
-- the class comes from the student's profile, never from the request row itself
create or replace function public.can_review_leave(student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_admin()
        or exists (select 1 from profiles s
                   where s.id = student and s.role = 'murid' and s.class is not null
                     and public.is_teaching_class(s.class));
$$;
revoke all on function public.can_review_leave(uuid) from public, anon;
grant execute on function public.can_review_leave(uuid) to authenticated;

-- teachers read the requests of their students
drop policy if exists leave_requests_select_teacher on public.leave_requests;
create policy leave_requests_select_teacher on public.leave_requests
    for select to authenticated
    using (public.can_review_leave(user_id));

-- ... and the letter photo attached to them
drop policy if exists attendance_photos_select_leave_teacher on storage.objects;
create policy attendance_photos_select_leave_teacher on storage.objects
    for select to authenticated
    using (bucket_id = 'attendance-photos'
           and exists (select 1 from public.leave_requests lr
                       where lr.proof_url = objects.name
                         and public.can_review_leave(lr.user_id)));

-- approve or reject one request
create or replace function public.review_leave(p_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    r record;
    me record;
    d date;
    days text[] := array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    n int := 0;
begin
    if auth.uid() is null then raise exception 'LEAVE_NOT_ALLOWED'; end if;
    if p_decision not in ('approved', 'rejected') then raise exception 'LEAVE_BAD_DECISION'; end if;

    select * into r from leave_requests where id = p_id for update;
    if not found then raise exception 'LEAVE_NOT_FOUND'; end if;
    if not public.can_review_leave(r.user_id) then raise exception 'LEAVE_NOT_ALLOWED'; end if;
    if r.status is distinct from 'pending' then
        raise exception 'LEAVE_ALREADY' using hint = 'This request was already reviewed';
    end if;

    select name, role into me from profiles where id = auth.uid();

    if p_decision = 'approved' then
        d := r.start_date;
        while d <= coalesce(r.end_date, r.start_date) loop
            update attendance
               set status = r.type, reason = coalesce(r.reason, ''),
                   proof_url = coalesce(r.proof_url, proof_url),
                   lat = null, lng = null, accuracy_m = null, distance_m = null
             where user_id = r.user_id and date = d;
            if not found then
                insert into attendance (user_id, name, class, date, day, status, reason, proof_url)
                select r.user_id, coalesce(p.name, r.name), coalesce(p.class, r.class), d,
                       days[extract(dow from d)::int + 1], r.type, coalesce(r.reason, ''), r.proof_url
                from profiles p where p.id = r.user_id;
            end if;
            n := n + 1;
            d := d + 1;
        end loop;
    end if;

    update leave_requests
       set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
           reviewed_by_name = me.name
     where id = p_id;

    -- the student hears about a rejection (an approval already sends "Absensimu tercatat")
    if p_decision = 'rejected' then
        begin
            insert into push_queue (user_id, title, body, url, tag)
            select r.user_id, 'Pengajuan ' || coalesce(r.type, 'Izin') || ' ditolak',
                   'Ditolak oleh ' || coalesce(me.name, 'guru') || '. Silakan absen seperti biasa atau hubungi wali kelas.',
                   'leave.html', 'leave-' || r.id
            where exists (select 1 from push_subscriptions where user_id = r.user_id);
        exception when others then
            raise warning 'review_leave push: %', sqlerrm;
        end;
    end if;

    return jsonb_build_object('status', p_decision, 'days', n);
end $$;
revoke all on function public.review_leave(uuid, text) from public, anon;
grant execute on function public.review_leave(uuid, text) to authenticated;

-- a new request: push to the class teachers too (admins already get one)
create or replace function public.queue_teacher_leave_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    cls text;
    who text;
    span text;
begin
    begin
        select class, name into cls, who from profiles where id = new.user_id and role = 'murid';
        if cls is null then return new; end if;
        who := coalesce(nullif(trim(new.name), ''), who, 'Siswa');
        span := case when new.end_date is null or new.end_date = new.start_date
                     then to_char(new.start_date, 'DD/MM')
                     else to_char(new.start_date, 'DD/MM') || '–' || to_char(new.end_date, 'DD/MM') end;
        insert into push_queue (user_id, title, body, url, tag)
        select distinct t.id,
               '📝 ' || coalesce(new.type, 'Izin') || ' · ' || who,
               left(cls || ' · ' || span || coalesce(' — ' || nullif(trim(new.reason), ''), ''), 180),
               'teacher-leave.html', 'teacher-leave-' || new.id
        from profiles t
        join push_subscriptions ps on ps.user_id = t.id
        where t.role = 'guru'
          and (t.class = cls
               or exists (select 1 from class_schedules cs where cs.teacher_id = t.id and cs.class = cls));
    exception when others then
        raise warning 'queue_teacher_leave_push: %', sqlerrm;
    end;
    return new;
end $$;

drop trigger if exists queue_teacher_leave_push on public.leave_requests;
create trigger queue_teacher_leave_push after insert on public.leave_requests
    for each row execute function public.queue_teacher_leave_push();
