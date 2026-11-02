-- Hari masuk di hari libur (misal Sabtu kelas pengganti) bisa untuk semua kelas ATAU kelas tertentu saja.
--   holidays.classes = null      -> berlaku untuk semua kelas (seperti sebelumnya)
--   holidays.classes = ["XII IPA A", ...] -> hanya kelas itu yang masuk; kelas lain tetap libur
-- Aman dijalankan lebih dari sekali.

alter table public.holidays add column if not exists classes jsonb;

create or replace function public.att_day_open(p_class text, p_date date)
returns boolean
language sql stable security definer set search_path = public as $$
    with ag as (
        select bool_or(coalesce(attendance_open, type <> 'holiday') = false) as closed,
               bool_or(attendance_open = true and (classes is null or classes @> to_jsonb(p_class))) as forced_open
        from holidays where date = p_date
    )
    select case
        when (select closed from ag) then false
        when (select forced_open from ag) then true
        -- tanggal merah nasional
        when exists (select 1 from national_holidays n where n.date = p_date and n.kind = 'libur') then false
        -- libur tiap minggu seluruh sekolah (misal Sabtu & Minggu)
        when coalesce((select weekly_off from attendance_period_settings where id = 'global'), '[]'::jsonb)
             @> to_jsonb(extract(isodow from p_date)::int) then false
        else coalesce((
            select s.active_days @> to_jsonb(extract(isodow from p_date)::int)
            from attendance_schedules s where s.class = p_class
        ), true)    -- class without a schedule: every day is allowed
    end;
$$;
revoke execute on function public.att_day_open(text, date) from public, anon;
grant execute on function public.att_day_open(text, date) to authenticated, service_role;
