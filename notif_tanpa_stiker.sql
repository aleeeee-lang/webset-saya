-- Notifikasi tanpa stiker/emoji: buang emoji dari judul semua notifikasi yang dibuat database
-- (pengumuman, izin, saran, SPP, juara, absen dibuka/pulang, QR). Isi pesan lainnya tetap sama.
-- Aman dijalankan lebih dari sekali.
do $$
declare
    f record;
    src text;
begin
    for f in
        select p.oid
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prosrc ~ '[\U0001F300-\U0001FAFF☀-➿⭐⏰-⏺]'
    loop
        src := pg_get_functiondef(f.oid);
        -- the emoji, an optional variation selector and the space after it
        src := regexp_replace(src, '[\U0001F300-\U0001FAFF☀-➿⭐⏰-⏺]️? ?', '', 'g');
        execute src;
    end loop;
end $$;
