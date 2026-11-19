\set ON_ERROR_STOP on
-- Use only an empty, disposable database. This fixture creates Supabase-like roles.
\ir manual_momo_launch.sql

create temp table original_products as select id, to_jsonb(p) as row from public.products p;
create temp table original_settings as select id, to_jsonb(b) as row from public.brand_settings b;
create temp table original_orders as select id, to_jsonb(o) as row from public.orders o;

\ir ../migrations/202611190001_merchant_catalogue.sql
create temp table settings_revisions as select id, settings_revision from public.brand_settings;
\ir ../migrations/202611190001_merchant_catalogue.sql

do $$
begin
  if exists (select 1 from original_products old full join public.products new using (id)
              where old.row is distinct from (to_jsonb(new) - array['published','bestseller_featured']))
     or exists (select 1 from original_settings old full join public.brand_settings new using (id)
              where old.row is distinct from (to_jsonb(new) - 'settings_revision'))
     or exists (select 1 from original_orders old full join public.orders new using (id)
              where old.row is distinct from to_jsonb(new))
     or exists (select 1 from public.products where not published or bestseller_featured)
     or exists (select 1 from settings_revisions old join public.brand_settings new using (id)
              where old.settings_revision is distinct from new.settings_revision)
     or has_function_privilege('anon', 'public.omans_assert_published_order()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.omans_assert_published_order()', 'EXECUTE')
  then raise exception 'Merchant migration changed existing records or permissions.'; end if;
end
$$;

set role service_role;
do $$
declare
  prior_stock integer;
begin
  select stock_quantity into prior_stock from public.products where id = 1;
  update public.products set published = false where id = 1;
  begin
    insert into public.orders (checkout_request_id, items, total, fulfilment_method, delivery_fee, payment_reference, momo_phone)
    values (pg_catalog.gen_random_uuid(), '[{"productId":1,"unitPrice":10.08,"quantity":1}]',
            10.08, 'pickup', 0, 'UNPUBLISHED-FIXTURE', '+233240000000');
    raise exception 'Unpublished product was ordered.';
  exception when raise_exception then
    if sqlerrm <> 'omans_checkout_catalogue_changed' then raise; end if;
  end;
  if (select stock_quantity from public.products where id = 1) is distinct from prior_stock
     or exists (select 1 from public.orders where payment_reference = 'UNPUBLISHED-FIXTURE')
     or exists (select 1 from public.omans_confirmed_bestsellers() where product_id = '1')
  then raise exception 'Unpublishing affected stock, orders, or public best sellers incorrectly.'; end if;
end
$$;
reset role;

select 'Merchant catalogue migration fixture passed' as result;
