-- Tambahan 2026-11-06. Aman dijalankan ulang.
-- 1. Siswa bisa menghapus pesanan kantin yang sudah selesai/ditolak/dibatalkan dari daftar "Pesananku"
--    (hanya disembunyikan dari daftarnya; laporan kantin dan riwayat tabungan tetap).
-- 2. Tiap admin memposting Informasi, semua pengguna yang menyalakan notifikasi dapat notifikasi di HP.

alter table public.kantin_orders add column if not exists student_hidden boolean not null default false;

create or replace function public.kantin_hide(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
    update kantin_orders set student_hidden = true
    where id = p_id and student_id = auth.uid() and status in ('selesai','ditolak','batal');
    if not found then raise exception 'Pesanan ini belum bisa dihapus'; end if;
end $$;
grant execute on function public.kantin_hide(uuid) to authenticated;

create or replace function public.queue_info_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    begin
        insert into push_queue (user_id, title, body, url, tag)
        select distinct ps.user_id,
               'Informasi baru',
               left(coalesce(nullif(trim(new.title), ''), 'Informasi') || coalesce(' — ' || nullif(trim(new.body), ''), ''), 180),
               'information.html', 'info-' || new.id
        from push_subscriptions ps
        join profiles p on p.id = ps.user_id
        where ps.user_id is distinct from new.created_by
          and coalesce(p.status, 'active') <> 'inactive';
    exception when others then
        raise warning 'queue_info_push: %', sqlerrm;
    end;
    return new;
end $$;
drop trigger if exists queue_info_push on public.school_info;
create trigger queue_info_push after insert on public.school_info for each row execute function public.queue_info_push();

-- cek: harus 2 baris "true"
select 'hapus pesanan' as fitur, exists (select 1 from information_schema.columns where table_name = 'kantin_orders' and column_name = 'student_hidden') as ok
union all
select 'notif informasi', exists (select 1 from pg_trigger where tgname = 'queue_info_push');
