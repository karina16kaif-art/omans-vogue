-- After both migrations, run as a database administrator on the target project.
-- Returns aggregate counts and permissions without exposing customer records or credentials.
with permissions as (
  select r.rolname as role_name, t.relname as table_name, t.relrowsecurity as rls_enabled,
         has_schema_privilege(r.oid, t.relnamespace, 'USAGE') as schema_usage,
         has_any_column_privilege(r.oid, t.oid, 'SELECT') as can_read,
         has_any_column_privilege(r.oid, t.oid, 'INSERT') as can_insert,
         has_any_column_privilege(r.oid, t.oid, 'UPDATE') as can_update,
         has_table_privilege(r.oid, t.oid, 'DELETE, TRUNCATE') as can_remove_rows
  from pg_class t cross join pg_roles r
  where t.oid in ('public.orders'::regclass, 'public.products'::regclass,
                  'public.brand_settings'::regclass, 'public.admin_credentials'::regclass)
    and r.rolname in ('anon', 'authenticated', 'service_role')
)
select jsonb_build_object(
  'permissions', (select jsonb_agg(to_jsonb(p) order by table_name, role_name) from permissions p),
  'order_count', (select count(*) from public.orders),
  'product_count', (select count(*) from public.products),
  'product_min_id', (select min(id)::text from public.products),
  'product_max_id', (select max(id)::text from public.products),
  'product_id_sequence', pg_get_serial_sequence('public.products', 'id'),
  'order_id_sequence', pg_get_serial_sequence('public.orders', 'id'),
  'stock_mismatches', (select count(*) from public.products where stock is distinct from stock_quantity),
  'zero_stock_enabled', (select count(*) from public.products
    where archived_at is null and stock_quantity = 0 and in_stock is not false
      and coalesce(jsonb_array_length(variants), 0) = 0),
  'untracked_base_products', (select count(*) from public.products
    where archived_at is null and stock_quantity is null and coalesce(jsonb_array_length(variants), 0) = 0),
  'fee_mismatches', (select count(*) from public.brand_settings where delivery_fee is distinct from campus_delivery_fee),
  'settings_row_present', exists (select 1 from public.brand_settings where id = 1),
  'momo_configured', exists (select 1 from public.brand_settings
    where id = 1 and nullif(btrim(momo_number), '') is not null and nullif(btrim(momo_account_name), '') is not null),
  'momo_reference_index_ready', exists (
    select 1 from pg_index
    where indexrelid = to_regclass('public.omans_orders_momo_reference_key')
      and indrelid = 'public.orders'::regclass and indisunique and indisvalid and indisready
  ),
  'checkout_request_index_ready', exists (
    select 1 from pg_index i join pg_attribute a
      on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    where i.indrelid = 'public.orders'::regclass and a.attname = 'checkout_request_id'
      and i.indisunique and i.indimmediate and i.indisvalid and i.indisready
      and i.indpred is null and i.indnkeyatts = 1
  )
) as release_checks;
