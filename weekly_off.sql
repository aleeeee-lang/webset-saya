-- Libur tiap minggu (misal Sabtu & Minggu) untuk seluruh sekolah, diatur admin di Kalender.
--   * attendance_period_settings.weekly_off = hari libur rutin (1=Senin ... 7=Minggu)
--   * att_day_open(): hari libur rutin = tutup, KECUALI tanggal itu dibuka admin
--     (agenda "Masuk sekolah" dengan absen dibuka) -> tetap masuk, misalnya Sabtu kelas pengganti.
-- Aman dijalankan lebih dari sekali.

alter table public.attendance_period_settings
    add column if not exists weekly_off jsonb not null default '[]'::jsonb;

insert into public.attendance_period_settings (id) values ('global')
on conflict (id) do nothing;

create or replace function public.att_day_open(p_class text, p_date date)
returns boolean
language sql stable security definer set search_path = public as $$
    with ag as (
        select bool_or(coalesce(attendance_open, type <> 'holiday') = false) as closed,
               bool_or(attendance_open = true) as forced_open
        from holidays where date = p_date
    )
    select case
        when (select closed from ag) then false
        when (select forced_open from ag) then true
        -- weekly day off for the whole school (e.g. Saturday & Sunday)
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
