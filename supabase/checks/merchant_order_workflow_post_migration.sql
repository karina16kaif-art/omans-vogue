select
  (select count(*) from public.products) as products,
  (select count(*) from public.brand_settings) as brand_settings,
  (select count(*) from public.orders) as saved_orders,
  (select count(*) from public.delivery_quotes) as purchase_requests,
  (select count(*) from public.orders o join public.delivery_quotes q on q.id = o.delivery_quote_id
    where o.order_number is distinct from q.order_number) as mismatched_order_numbers,
  (select count(*) from public.orders where order_number is null or merchant_status is null)
    + (select count(*) from public.delivery_quotes where order_number is null or merchant_status is null) as incomplete_workflow_rows,
  (select count(*) from pg_catalog.pg_trigger
    where not tgisinternal and tgname in ('omans_saved_order_workflow', 'omans_delivery_purchase_workflow')
    and tgrelid in ('public.orders'::regclass, 'public.delivery_quotes'::regclass) and tgenabled in ('O', 'A')) as enabled_workflow_triggers,
  (select bool_and(relrowsecurity) from pg_catalog.pg_class
    where oid in ('public.orders'::regclass, 'public.delivery_quotes'::regclass)) as rls_enabled,
  (select bool_and(not pg_catalog.has_any_column_privilege(api_role, tbl, 'SELECT, INSERT, UPDATE, REFERENCES')
    and not pg_catalog.has_table_privilege(api_role, tbl, 'DELETE, TRUNCATE')
    and not pg_catalog.has_sequence_privilege(api_role, 'public.omans_order_number_seq', 'USAGE, SELECT, UPDATE'))
    from unnest(array['anon', 'authenticated']) as api_role
    cross join unnest(array['public.orders', 'public.delivery_quotes']) as tbl) as public_access_denied;
