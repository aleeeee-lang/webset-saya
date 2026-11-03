-- Keuangan pribadi (2026-11): kategori untuk tiap pengeluaran pribadi
-- (Makan & jajan, Transport, Pulsa & data, Sekolah, Belanja, Lainnya).
-- Transaksi lama tanpa kategori tampil sebagai "Lainnya". Aman dijalankan ulang.
alter table public.personal_savings add column if not exists category text;
alter table public.personal_savings drop constraint if exists personal_savings_category_len;
alter table public.personal_savings add constraint personal_savings_category_len check (category is null or length(category) <= 20);
