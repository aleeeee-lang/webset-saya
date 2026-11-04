-- Absen untuk petugas kantin (2026-11)
-- Petugas (role "koperasi") absen sebagai grup "Kantin", dengan jam sendiri
-- (diatur admin di Jadwal absen -> "Petugas kantin"). Kalau jamnya belum diatur,
-- absen kantin bisa dilakukan kapan saja di hari sekolah.
-- File ini hanya menambah "koperasi" ke fungsi absen yang sudah ada. Aman dijalankan ulang.

do $$
declare d text; n int := 0;
begin
    -- 1. absen masuk
    d := pg_get_functiondef('public.guard_self_attendance()'::regprocedure);
    if position('''koperasi''' in d) = 0 then
        d := replace(d, $x$if p.role is distinct from 'murid' and p.role is distinct from 'guru' then$x$,
                        $x$if p.role is distinct from 'murid' and p.role is distinct from 'guru' and p.role is distinct from 'koperasi' then$x$);
        d := replace(d, $x$ckey := case when p.role = 'guru' then 'Guru' else p.class end;$x$,
                        $x$ckey := case when p.role = 'guru' then 'Guru' when p.role = 'koperasi' then 'Kantin' else p.class end;$x$);
        execute d; n := n + 1;
    end if;

    -- 2. absen pulang
    d := pg_get_functiondef('public.att_checkout(text, uuid, double precision, double precision, double precision, text)'::regprocedure);
    if position('''koperasi''' in d) = 0 then
        d := replace(d, $x$if p.role is distinct from 'murid' and p.role is distinct from 'guru' then$x$,
                        $x$if p.role is distinct from 'murid' and p.role is distinct from 'guru' and p.role is distinct from 'koperasi' then$x$);
        d := replace(d, $x$ckey := case when p.role = 'guru' then 'Guru' else p.class end;$x$,
                        $x$ckey := case when p.role = 'guru' then 'Guru' when p.role = 'koperasi' then 'Kantin' else p.class end;$x$);
        execute d; n := n + 1;
    end if;

    -- 3. notifikasi "Absen sudah dibuka" ikut terkirim ke petugas kantin
    d := pg_get_functiondef('public.att_open_send(text)'::regprocedure);
    if position('''koperasi''' in d) = 0 then
        d := replace(d, $x$(case when p_class = 'Guru' then p.role = 'guru' else p.role = 'murid' and p.class = p_class end)$x$,
                        $x$(case when p_class = 'Guru' then p.role = 'guru' when p_class = 'Kantin' then p.role = 'koperasi' else p.role = 'murid' and p.class = p_class end)$x$);
        execute d; n := n + 1;
    end if;

    raise notice 'kantin_absen: % fungsi diperbarui', n;
end $$;

-- cek: tiga baris ini harus "true"
select 'absen masuk' as fungsi, position('''koperasi''' in pg_get_functiondef('public.guard_self_attendance()'::regprocedure)) > 0 as ok
union all
select 'absen pulang', position('''koperasi''' in pg_get_functiondef('public.att_checkout(text, uuid, double precision, double precision, double precision, text)'::regprocedure)) > 0
union all
select 'notif absen dibuka', position('''koperasi''' in pg_get_functiondef('public.att_open_send(text)'::regprocedure)) > 0;
