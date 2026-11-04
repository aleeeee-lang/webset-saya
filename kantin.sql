-- Kantin / koperasi (2026-11)
-- 1. role baru "koperasi" (petugas kantin)
-- 2. tabel barang (dengan kategori), pesanan, kode bayar QR
-- 3. fungsi pesan / terima / tolak / siap / kasir (saldo dipotong di sini, bukan dari HP)
-- 4. tempat foto barang (storage "kantin")
-- Aman dijalankan ulang.

-- 1. role ---------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
    check (role = any (array['murid','guru','orangtua','admin','koperasi']));

create or replace function public.is_kantin() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from profiles where id = auth.uid()
                   and role in ('admin','koperasi') and coalesce(status,'active') = 'active');
$$;

-- 2. tables -------------------------------------------------------------
create table if not exists public.kantin_items (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 1 and 40),
    price integer not null check (price between 0 and 10000000),
    stock integer not null default 0 check (stock between 0 and 100000),
    photo text check (photo is null or char_length(photo) <= 300),
    category text not null default 'lainnya',
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table public.kantin_items add column if not exists category text not null default 'lainnya';
alter table public.kantin_items drop constraint if exists kantin_items_category_check;
alter table public.kantin_items add constraint kantin_items_category_check
    check (category in ('makanan','minuman','jajanan','sekolah','lainnya'));
alter table public.kantin_items enable row level security;
drop policy if exists kantin_items_read on public.kantin_items;
create policy kantin_items_read on public.kantin_items for select to authenticated using (active or is_kantin());
drop policy if exists kantin_items_write on public.kantin_items;
create policy kantin_items_write on public.kantin_items for all to authenticated using (is_kantin()) with check (is_kantin());

create table if not exists public.kantin_orders (
    id uuid primary key default gen_random_uuid(),
    code text not null,
    student_id uuid references public.profiles(id) on delete set null,
    student_name text,
    student_class text,
    items jsonb not null,            -- [{id,name,price,qty}]
    total integer not null check (total >= 0),
    pay text not null check (pay in ('saldo','tunai')),
    status text not null check (status in ('baru','dibuat','siap','selesai','ditolak','batal')),
    source text not null check (source in ('pesan','kasir')),
    saving_id uuid,
    handled_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists kantin_orders_student_idx on public.kantin_orders (student_id, created_at desc);
create index if not exists kantin_orders_status_idx on public.kantin_orders (status, created_at desc);
alter table public.kantin_orders enable row level security;
drop policy if exists kantin_orders_read on public.kantin_orders;
create policy kantin_orders_read on public.kantin_orders for select to authenticated
    using (student_id = auth.uid() or is_kantin());
-- no insert/update policies: everything goes through the functions below

-- short-lived pay codes the student shows as QR at the counter
create table if not exists public.kantin_tokens (
    code text primary key,
    student_id uuid not null references public.profiles(id) on delete cascade,
    expires_at timestamptz not null
);
alter table public.kantin_tokens enable row level security;

-- 3. functions ------------------------------------------------------------
create or replace function public._kantin_balance(p_student uuid) returns numeric
language sql stable security definer set search_path = public as $$
    select coalesce(sum(case when type = 'setor' then amount else -amount end), 0)
    from savings where student_id = p_student;
$$;

-- checks + reserves stock; returns {lines, total}
create or replace function public._kantin_take(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; q int; r kantin_items; lines jsonb := '[]'::jsonb; tot int := 0;
begin
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Pilih barang dulu';
    end if;
    if jsonb_array_length(p_items) > 30 then raise exception 'Terlalu banyak barang'; end if;
    for it in select * from jsonb_array_elements(p_items) loop
        q := coalesce((it->>'qty')::int, 0);
        if q < 1 or q > 50 then raise exception 'Jumlah tidak valid'; end if;
        select * into r from kantin_items where id = (it->>'id')::uuid for update;
        if not found or not r.active then raise exception 'Barang tidak tersedia'; end if;
        if r.stock < q then raise exception 'Stok % tinggal %', r.name, r.stock; end if;
        update kantin_items set stock = stock - q, updated_at = now() where id = r.id;
        lines := lines || jsonb_build_object('id', r.id, 'name', r.name, 'price', r.price, 'qty', q);
        tot := tot + r.price * q;
    end loop;
    return jsonb_build_object('lines', lines, 'total', tot);
end $$;

create or replace function public._kantin_restock(p_lines jsonb) returns void
language sql security definer set search_path = public as $$
    update kantin_items k set stock = k.stock + (l->>'qty')::int, updated_at = now()
    from jsonb_array_elements(p_lines) l where k.id = (l->>'id')::uuid;
$$;

create or replace function public._kantin_code() returns text
language sql volatile as $$ select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)); $$;

-- student: place an order
create or replace function public.kantin_order(p_items jsonb, p_pay text) returns kantin_orders
language plpgsql security definer set search_path = public as $$
declare me profiles; t jsonb; o kantin_orders;
begin
    select * into me from profiles where id = auth.uid();
    if me.id is null or me.role <> 'murid' or coalesce(me.status,'active') <> 'active' then raise exception 'Hanya untuk siswa'; end if;
    if p_pay not in ('saldo','tunai') then raise exception 'Cara bayar tidak valid'; end if;
    if (select count(*) from kantin_orders where student_id = me.id and status in ('baru','dibuat','siap')) >= 3 then
        raise exception 'Masih ada 3 pesanan yang belum selesai';
    end if;
    t := _kantin_take(p_items);
    if p_pay = 'saldo' and _kantin_balance(me.id) < (t->>'total')::int then raise exception 'Saldo tidak cukup'; end if;
    insert into kantin_orders (code, student_id, student_name, student_class, items, total, pay, status, source)
    values (_kantin_code(), me.id, me.name, me.class, t->'lines', (t->>'total')::int, p_pay, 'baru', 'pesan')
    returning * into o;
    begin
        insert into push_queue (user_id, title, body, url, tag)
        select p.id, 'Pesanan baru #' || o.code, coalesce(me.name,'Siswa') || ' · ' || coalesce(me.class,'') || ' · Rp' || o.total, 'kantin.html', 'kantin-' || o.id
        from profiles p join push_subscriptions ps on ps.user_id = p.id
        where p.role = 'koperasi' and coalesce(p.status,'active') = 'active'
        group by p.id;
    exception when others then raise warning 'kantin push: %', sqlerrm; end;
    return o;
end $$;

-- student: cancel an order nobody has accepted yet
create or replace function public.kantin_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o kantin_orders;
begin
    select * into o from kantin_orders where id = p_id and student_id = auth.uid() for update;
    if o.id is null or o.status <> 'baru' then raise exception 'Pesanan tidak bisa dibatalkan'; end if;
    perform _kantin_restock(o.items);
    update kantin_orders set status = 'batal', updated_at = now() where id = o.id;
end $$;

-- staff: move an order along (dibuat = diterima, ditolak, siap, selesai)
create or replace function public.kantin_set_status(p_id uuid, p_status text) returns kantin_orders
language plpgsql security definer set search_path = public as $$
declare o kantin_orders; sid uuid;
begin
    if not is_kantin() then raise exception 'Hanya petugas kantin'; end if;
    select * into o from kantin_orders where id = p_id for update;
    if o.id is null then raise exception 'Pesanan tidak ada'; end if;
    if p_status = 'dibuat' and o.status = 'baru' then
        if o.pay = 'saldo' then
            if _kantin_balance(o.student_id) < o.total then raise exception 'Saldo siswa tidak cukup'; end if;
            insert into savings (student_id, type, amount, note, created_by)
            values (o.student_id, 'tarik', o.total, 'Kantin #' || o.code, auth.uid()) returning id into sid;
        end if;
        update kantin_orders set status = 'dibuat', saving_id = sid, handled_by = auth.uid(), updated_at = now() where id = o.id returning * into o;
    elsif p_status = 'ditolak' and o.status in ('baru','dibuat') then
        if o.saving_id is not null then delete from savings where id = o.saving_id; end if;
        perform _kantin_restock(o.items);
        update kantin_orders set status = 'ditolak', saving_id = null, handled_by = auth.uid(), updated_at = now() where id = o.id returning * into o;
    elsif p_status = 'siap' and o.status = 'dibuat' then
        update kantin_orders set status = 'siap', updated_at = now() where id = o.id returning * into o;
    elsif p_status = 'selesai' and o.status in ('siap','dibuat') then
        update kantin_orders set status = 'selesai', updated_at = now() where id = o.id returning * into o;
    else
        raise exception 'Status tidak bisa diubah';
    end if;
    if o.status in ('siap','ditolak') and o.student_id is not null then
        begin
            insert into push_queue (user_id, title, body, url, tag)
            select o.student_id,
                   case when o.status = 'siap' then 'Pesananmu siap diambil' else 'Pesananmu ditolak kantin' end,
                   '#' || o.code || ' · Rp' || o.total, 'kantin.html', 'kantin-' || o.id
            where exists (select 1 from push_subscriptions where user_id = o.student_id);
        exception when others then raise warning 'kantin push: %', sqlerrm; end;
    end if;
    return o;
end $$;

-- student: a pay code for the counter, valid 3 minutes
create or replace function public.kantin_token() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
    if not exists (select 1 from profiles where id = auth.uid() and role = 'murid') then raise exception 'Hanya untuk siswa'; end if;
    delete from kantin_tokens where student_id = auth.uid() or expires_at < now();
    c := 'KT' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    insert into kantin_tokens values (c, auth.uid(), now() + interval '3 minutes');
    return c;
end $$;

-- staff: sell at the counter (tunai, or saldo with the student's pay code)
create or replace function public.kantin_sell(p_items jsonb, p_pay text, p_code text default null) returns kantin_orders
language plpgsql security definer set search_path = public as $$
declare t jsonb; o kantin_orders; st profiles; sid uuid;
begin
    if not is_kantin() then raise exception 'Hanya petugas kantin'; end if;
    if p_pay not in ('saldo','tunai') then raise exception 'Cara bayar tidak valid'; end if;
    if p_pay = 'saldo' then
        select p.* into st from kantin_tokens k join profiles p on p.id = k.student_id
        where k.code = upper(trim(p_code)) and k.expires_at > now();
        if st.id is null then raise exception 'QR tidak berlaku, minta siswa buka ulang QR-nya'; end if;
        delete from kantin_tokens where code = upper(trim(p_code));
    end if;
    t := _kantin_take(p_items);
    if p_pay = 'saldo' then
        if _kantin_balance(st.id) < (t->>'total')::int then raise exception 'Saldo % tidak cukup', st.name; end if;
        insert into savings (student_id, type, amount, note, created_by)
        values (st.id, 'tarik', (t->>'total')::int, 'Kantin (kasir)', auth.uid()) returning id into sid;
    end if;
    insert into kantin_orders (code, student_id, student_name, student_class, items, total, pay, status, source, saving_id, handled_by)
    values (_kantin_code(), st.id, st.name, st.class, t->'lines', (t->>'total')::int, p_pay, 'selesai', 'kasir', sid, auth.uid())
    returning * into o;
    return o;
end $$;

revoke all on function public._kantin_balance(uuid), public._kantin_take(jsonb), public._kantin_restock(jsonb) from public, anon, authenticated;
grant execute on function public.kantin_order(jsonb, text), public.kantin_cancel(uuid), public.kantin_set_status(uuid, text),
    public.kantin_token(), public.kantin_sell(jsonb, text, text), public.is_kantin() to authenticated;

-- live updates for the order list
do $$ begin
    alter publication supabase_realtime add table public.kantin_orders;
exception when others then null; end $$;

-- 4. photos -----------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('kantin', 'kantin', true) on conflict (id) do nothing;
drop policy if exists kantin_photo_read on storage.objects;
create policy kantin_photo_read on storage.objects for select using (bucket_id = 'kantin');
drop policy if exists kantin_photo_write on storage.objects;
create policy kantin_photo_write on storage.objects for insert to authenticated with check (bucket_id = 'kantin' and public.is_kantin());
drop policy if exists kantin_photo_update on storage.objects;
create policy kantin_photo_update on storage.objects for update to authenticated using (bucket_id = 'kantin' and public.is_kantin());
drop policy if exists kantin_photo_delete on storage.objects;
create policy kantin_photo_delete on storage.objects for delete to authenticated using (bucket_id = 'kantin' and public.is_kantin());
