-- =====================================================================
-- Saklar "Jam otomatis dari jadwal pelajaran" (2026-11)
-- Admin bisa mematikan / menyalakan jam absen otomatis (jam_otomatis.sql)
-- dari Kelola > Jadwal > Jam absen. Bawaan: NYALA.
-- Saat mati: kelas yang jamnya belum diatur admin kembali seperti dulu
-- (absen bisa kapan saja, setiap hari).
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- =====================================================================

alter table public.attendance_period_settings
    add column if not exists auto_hours boolean not null default true;

create or replace function public.att_auto_on()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce((select auto_hours from attendance_period_settings where id = 'global'), true);
$$;

create or replace function public.att_window(p_class text, p_date date)
returns table (start_time time, end_time time, late_mode text, late_end_time time,
               checkout_start time, checkout_end time, auto boolean)
language plpgsql stable security definer set search_path = public as $$
declare s record; f time; l time;
begin
    select * into s from attendance_schedules a where a.class = p_class;
    if found then
        return query select s.start_time, s.end_time, s.late_mode, s.late_end_time,
                            s.checkout_start, s.checkout_end, false;
        return;
    end if;
    if not public.att_auto_on() then return; end if;   -- switched off by the admin
    select min(c.start_time), max(coalesce(c.end_time, c.start_time)) into f, l
    from class_schedules c
    where c.class = p_class and c.day = extract(isodow from p_date)::int;
    if f is null then return; end if;
    return query select (f - interval '30 minutes')::time, (f + interval '15 minutes')::time,
                        'block'::text, null::time,
                        l, (l + interval '10 minutes')::time, true;
end $$;

create or replace function public.att_day_open(p_class text, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
    with ag as (
        select bool_or(coalesce(attendance_open, type <> 'holiday') = false) as closed,
               bool_or(attendance_open = true and (classes is null or classes @> to_jsonb(p_class))) as forced_open
        from holidays where date = p_date
    )
    select case
        when (select closed from ag) then false
        when (select forced_open from ag) then true
        when exists (select 1 from national_holidays n where n.date = p_date and n.kind = 'libur') then false
        when coalesce((select weekly_off from attendance_period_settings where id = 'global'), '[]'::jsonb)
             @> to_jsonb(extract(isodow from p_date)::int) then false
        else coalesce(
            (select s.active_days @> to_jsonb(extract(isodow from p_date)::int)
             from attendance_schedules s where s.class = p_class),
            case when public.att_auto_on() and exists (select 1 from class_schedules c where c.class = p_class)
                 then exists (select 1 from class_schedules c where c.class = p_class
                              and c.day = extract(isodow from p_date)::int)
                 else true end)
    end;
$$;
