-- Kalender: libur tiap minggu + tanggal merah nasional otomatis. Aman dijalankan lebih dari sekali.
--
-- 1) attendance_period_settings.weekly_off = hari libur tiap minggu (1=Senin ... 7=Minggu), diatur admin di Kalender
-- 2) national_holidays = tanggal merah & cuti bersama dari SKB 3 Menteri (sudah terisi 2026 & 2027)
--      kind 'libur' -> sekolah libur otomatis, absen tutup
--      kind 'cuti'  -> cuti bersama: cuma tampil di kalender, absen tetap ikut jadwal
-- 3) att_day_open(): urutannya
--      agenda admin "tutup" -> tutup | agenda admin "buka" -> buka (misal Sabtu kelas pengganti, upacara 17 Agustus)
--      tanggal merah -> tutup | libur tiap minggu -> tutup | selain itu hari aktif kelas

alter table public.attendance_period_settings
    add column if not exists weekly_off jsonb not null default '[]'::jsonb;
insert into public.attendance_period_settings (id) values ('global') on conflict (id) do nothing;

create table if not exists public.national_holidays (
    date date primary key,
    name text not null,
    kind text not null default 'libur' check (kind in ('libur', 'cuti'))
);
alter table public.national_holidays enable row level security;
drop policy if exists national_holidays_read on public.national_holidays;
create policy national_holidays_read on public.national_holidays for select to authenticated using (true);
drop policy if exists national_holidays_admin on public.national_holidays;
create policy national_holidays_admin on public.national_holidays for all to authenticated using (is_admin()) with check (is_admin());

insert into public.national_holidays (date, name, kind) values
    -- 2026 (SKB 3 Menteri)
    ('2026-01-01', 'Tahun Baru 2026 Masehi', 'libur'),
    ('2026-01-16', 'Isra Mikraj Nabi Muhammad SAW', 'libur'),
    ('2026-02-16', 'Cuti bersama Tahun Baru Imlek', 'cuti'),
    ('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili', 'libur'),
    ('2026-03-18', 'Cuti bersama Hari Suci Nyepi', 'cuti'),
    ('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)', 'libur'),
    ('2026-03-20', 'Cuti bersama Idulfitri', 'cuti'),
    ('2026-03-21', 'Idulfitri 1447 H', 'libur'),
    ('2026-03-22', 'Idulfitri 1447 H', 'libur'),
    ('2026-03-23', 'Cuti bersama Idulfitri', 'cuti'),
    ('2026-03-24', 'Cuti bersama Idulfitri', 'cuti'),
    ('2026-04-03', 'Wafat Yesus Kristus', 'libur'),
    ('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)', 'libur'),
    ('2026-05-01', 'Hari Buruh Internasional', 'libur'),
    ('2026-05-14', 'Kenaikan Yesus Kristus', 'libur'),
    ('2026-05-15', 'Cuti bersama Kenaikan Yesus Kristus', 'cuti'),
    ('2026-05-27', 'Iduladha 1447 H', 'libur'),
    ('2026-05-28', 'Cuti bersama Iduladha', 'cuti'),
    ('2026-05-31', 'Hari Raya Waisak 2570 BE', 'libur'),
    ('2026-06-01', 'Hari Lahir Pancasila', 'libur'),
    ('2026-06-16', '1 Muharam Tahun Baru Islam 1448 H', 'libur'),
    ('2026-08-17', 'Proklamasi Kemerdekaan', 'libur'),
    ('2026-08-25', 'Maulid Nabi Muhammad SAW', 'libur'),
    ('2026-12-24', 'Cuti bersama Natal', 'cuti'),
    ('2026-12-25', 'Kelahiran Yesus Kristus (Natal)', 'libur'),
    -- 2027 (SKB 3 Menteri)
    ('2027-01-01', 'Tahun Baru 2027 Masehi', 'libur'),
    ('2027-01-05', 'Isra Mikraj Nabi Muhammad SAW', 'libur'),
    ('2027-02-05', 'Cuti bersama Tahun Baru Imlek', 'cuti'),
    ('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili', 'libur'),
    ('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)', 'libur'),
    ('2027-03-09', 'Cuti bersama Idulfitri', 'cuti'),
    ('2027-03-10', 'Idulfitri 1448 H', 'libur'),
    ('2027-03-11', 'Idulfitri 1448 H', 'libur'),
    ('2027-03-12', 'Cuti bersama Idulfitri', 'cuti'),
    ('2027-03-15', 'Cuti bersama Idulfitri', 'cuti'),
    ('2027-03-25', 'Cuti bersama Wafat Yesus Kristus', 'cuti'),
    ('2027-03-26', 'Wafat Yesus Kristus', 'libur'),
    ('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)', 'libur'),
    ('2027-05-01', 'Hari Buruh Internasional', 'libur'),
    ('2027-05-06', 'Kenaikan Yesus Kristus', 'libur'),
    ('2027-05-17', 'Iduladha 1448 H', 'libur'),
    ('2027-05-18', 'Cuti bersama Iduladha', 'cuti'),
    ('2027-05-19', 'Cuti bersama Waisak', 'cuti'),
    ('2027-05-20', 'Hari Raya Waisak 2571 BE', 'libur'),
    ('2027-06-01', 'Hari Lahir Pancasila', 'libur'),
    ('2027-06-06', '1 Muharam Tahun Baru Islam 1449 H', 'libur'),
    ('2027-08-15', 'Maulid Nabi Muhammad SAW', 'libur'),
    ('2027-08-17', 'Proklamasi Kemerdekaan', 'libur'),
    ('2027-12-24', 'Cuti bersama Natal', 'cuti'),
    ('2027-12-25', 'Kelahiran Yesus Kristus (Natal)', 'libur'),
    ('2027-12-26', 'Isra Mikraj Nabi Muhammad SAW', 'libur')
on conflict (date) do update set name = excluded.name, kind = excluded.kind;

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
