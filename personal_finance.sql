-- Personal money: a category for each personal deposit / withdrawal
-- (Jajan & makan, Transport, Pulsa, Uang saku, ...). Used by js/fin-personal.js.
-- Old rows keep no category and show as "Lainnya". Safe to run again.
alter table public.personal_savings add column if not exists category text;
alter table public.personal_savings drop constraint if exists personal_savings_category_len;
alter table public.personal_savings add constraint personal_savings_category_len check (category is null or length(category) <= 20);
