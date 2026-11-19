-- Run one numbered SELECT at a time in the Supabase SQL Editor.
-- These queries read schema and sequence metadata. Queries 3 and 10 also read ID ranges from existing tables.

-- Query 1. Column types, required fields, defaults, and identity configuration
select table_name, ordinal_position, column_name, data_type, udt_schema, udt_name,
       is_nullable, column_default, is_identity, identity_generation, is_generated
from information_schema.columns
where table_schema = 'public'
  and table_name in ('orders', 'products', 'brand_settings', 'admin_credentials')
order by table_name, ordinal_position;

-- Query 2. orders.id generator and sequence privileges
select format_type(a.atttypid, a.atttypmod) as id_type,
       a.attnotnull as id_not_null,
       case a.attidentity
         when 'a' then 'ALWAYS'
         when 'd' then 'BY DEFAULT'
         else 'NONE'
       end as identity_generation,
       pg_get_expr(d.adbin, d.adrelid) as id_default,
       pg_get_serial_sequence('public.orders', 'id') as owned_sequence,
       refs.default_sequences,
       s.sequenceowner, s.start_value, s.min_value, s.max_value,
       s.increment_by, s.cache_size, s.cycle, s.last_value as catalog_last_value,
       current_user as sql_editor_role,
       has_sequence_privilege(current_user, 'public.orders_id_seq', 'SELECT') as editor_can_read_sequence,
       has_sequence_privilege(current_user, 'public.orders_id_seq', 'USAGE') as editor_has_sequence_usage,
       has_sequence_privilege('service_role', 'public.orders_id_seq', 'USAGE') as service_role_has_sequence_usage
from pg_attribute a
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
left join pg_sequences s on s.schemaname = 'public' and s.sequencename = 'orders_id_seq'
left join lateral (
  select array_agg(format('%I.%I', n.nspname, c.relname) order by n.nspname, c.relname) as default_sequences
  from pg_depend p
  join pg_class c on c.oid = p.refobjid and c.relkind = 'S'
  join pg_namespace n on n.oid = c.relnamespace
  where p.classid = 'pg_attrdef'::regclass and p.objid = d.oid
    and p.refclassid = 'pg_class'::regclass
) refs on true
where a.attrelid = 'public.orders'::regclass and a.attname = 'id' and not a.attisdropped;

-- Query 3. Current sequence state and largest existing order ID
select last_value::text as sequence_value,
       is_called,
       (select max(id)::text from public.orders) as largest_order_id
from public.orders_id_seq;

-- Query 4. Constraints, including foreign keys from other tables into orders
select c.conrelid::regclass as on_table, c.conname, c.contype, c.convalidated,
       pg_get_constraintdef(c.oid, true) as definition
from pg_constraint c
where c.conrelid in (to_regclass('public.orders'), to_regclass('public.products'),
                     to_regclass('public.brand_settings'), to_regclass('public.admin_credentials'))
   or c.confrelid = to_regclass('public.orders')
order by c.conrelid, c.conname;

-- Query 5. Indexes, including validity and eligibility for an upsert conflict target
select i.indrelid::regclass as on_table, i.indexrelid::regclass as index_name,
       i.indisunique as is_unique, i.indimmediate as is_immediate,
       i.indisvalid as is_valid, i.indisready as is_ready, i.indpred is not null as is_partial,
       pg_get_indexdef(i.indexrelid) as definition
from pg_index i
where i.indrelid in (to_regclass('public.orders'), to_regclass('public.products'),
                     to_regclass('public.brand_settings'), to_regclass('public.admin_credentials'))
order by i.indrelid, i.indexrelid;

-- Query 6. User-defined triggers and the functions they call
select t.tgrelid::regclass as on_table, t.tgname,
       case t.tgenabled
         when 'O' then 'origin/local'
         when 'A' then 'always'
         when 'R' then 'replica only'
         when 'D' then 'disabled'
       end as enabled_when,
       t.tgfoid::regprocedure as trigger_function,
       f.prosecdef as security_definer,
       pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_proc f on f.oid = t.tgfoid
where t.tgrelid in (to_regclass('public.orders'), to_regclass('public.products'),
                    to_regclass('public.brand_settings'), to_regclass('public.admin_credentials'))
  and not t.tgisinternal
order by t.tgrelid, t.tgname;

-- Query 7. RLS flags and policies, including a row for tables with no policies
select n.nspname as schema_name, t.relname as table_name,
       t.relrowsecurity as rls_enabled, t.relforcerowsecurity as rls_forced,
       p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
from pg_class t
join pg_namespace n on n.oid = t.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = t.relname
where t.oid in (to_regclass('public.orders'), to_regclass('public.products'),
                to_regclass('public.brand_settings'), to_regclass('public.admin_credentials'))
order by t.relname, p.policyname;

-- Query 8. Grants and effective privileges for the Supabase API roles
select t.relname as table_name, r.rolname as api_role, r.rolbypassrls as bypasses_rls,
       has_schema_privilege(r.oid, t.relnamespace, 'USAGE') as schema_usage,
       has_table_privilege(r.oid, t.oid, 'SELECT') as table_select,
       has_table_privilege(r.oid, t.oid, 'INSERT') as table_insert,
       has_table_privilege(r.oid, t.oid, 'UPDATE') as table_update,
       has_table_privilege(r.oid, t.oid, 'DELETE') as table_delete,
       has_table_privilege(r.oid, t.oid, 'TRUNCATE') as table_truncate,
       has_any_column_privilege(r.oid, t.oid, 'SELECT') as any_column_select,
       has_any_column_privilege(r.oid, t.oid, 'INSERT') as any_column_insert,
       has_any_column_privilege(r.oid, t.oid, 'UPDATE') as any_column_update,
       t.relacl as explicit_table_acl,
       (select jsonb_object_agg(a.attname, a.attacl::text)
        from pg_attribute a
        where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
          and a.attacl is not null) as explicit_column_acls
from pg_class t
cross join pg_roles r
where t.oid in (to_regclass('public.orders'), to_regclass('public.products'),
                to_regclass('public.brand_settings'), to_regclass('public.admin_credentials'))
  and r.rolname in ('anon', 'authenticated', 'service_role')
order by t.relname, r.rolname;

-- Query 9. Admin credentials and indirect access through views or callable functions
-- Add any other Data API exposed application schemas to api_schemas.
with recursive
api_schemas(schema_name) as (values ('public'::name)),
api_roles as (
  select oid, rolname from pg_roles where rolname in ('anon', 'authenticated')
),
store_relations(oid) as (
  select c.oid
  from pg_class c
  where c.oid in (
    to_regclass('public.orders'), to_regclass('public.products'),
    to_regclass('public.brand_settings'), to_regclass('public.admin_credentials')
  )
  union
  select v.oid
  from store_relations s
  join pg_depend d on d.refobjid = s.oid
    and d.refclassid = 'pg_class'::regclass and d.classid = 'pg_rewrite'::regclass
  join pg_rewrite w on w.oid = d.objid
  join pg_class v on v.oid = w.ev_class and v.relkind in ('v', 'm')
)
select 'table' as object_type, 'public.admin_credentials' as object_name,
       null::text as api_role,
       jsonb_build_object('exists', c.oid is not null, 'rls_enabled', c.relrowsecurity,
         'acl', c.relacl::text) as details
from (values (to_regclass('public.admin_credentials'))) t(oid)
left join pg_class c on c.oid = t.oid
union all
select case when c.relkind = 'm' then 'materialized view' else 'view' end,
       format('%I.%I', n.nspname, c.relname), r.rolname::text,
       jsonb_build_object(
         'depends_on_store_table', s.oid is not null,
         'security_invoker', coalesce('security_invoker=true' = any(c.reloptions), false),
         'can_select', has_any_column_privilege(r.oid, c.oid, 'SELECT'),
         'can_insert', has_any_column_privilege(r.oid, c.oid, 'INSERT'),
         'can_update', has_any_column_privilege(r.oid, c.oid, 'UPDATE'),
         'can_delete', has_table_privilege(r.oid, c.oid, 'DELETE')
       )
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join api_schemas a on a.schema_name = n.nspname
left join store_relations s on s.oid = c.oid
cross join api_roles r
where c.relkind in ('v', 'm')
  and has_schema_privilege(r.oid, n.oid, 'USAGE')
  and (has_any_column_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE')
       or has_table_privilege(r.oid, c.oid, 'DELETE'))
union all
select 'function',
       format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
       r.rolname::text,
       jsonb_build_object('security_definer', p.prosecdef, 'owner', pg_get_userbyid(p.proowner),
         'mentions_store_table', pg_get_functiondef(p.oid) ~*
           '(^|[^a-z0-9_])(orders|products|brand_settings|admin_credentials)([^a-z0-9_]|$)')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join api_schemas a on a.schema_name = n.nspname
cross join api_roles r
where p.prokind = 'f'
  and p.prorettype not in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
  and has_schema_privilege(r.oid, n.oid, 'USAGE')
  and has_function_privilege(r.oid, p.oid, 'EXECUTE')
order by object_type, object_name, api_role;

-- Query 10. Product ID generator, allowed sequence range and existing ID range
select format_type(a.atttypid, a.atttypmod) as id_type, a.attnotnull as id_not_null,
       a.attidentity as identity_kind, pg_get_expr(d.adbin, d.adrelid) as id_default,
       pg_get_serial_sequence('public.products', 'id') as owned_sequence,
       s.increment_by, s.cache_size, s.cycle, s.max_value, s.last_value as catalog_last_value,
       (select min(id)::text from public.products) as smallest_product_id,
       (select max(id)::text from public.products) as largest_product_id,
       to_regclass('public.admin_credentials') is not null as admin_credentials_exists
from pg_attribute a
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
left join pg_sequences s on to_regclass(format('%I.%I', s.schemaname, s.sequencename)) =
  pg_get_serial_sequence('public.products', 'id')::regclass
where a.attrelid = 'public.products'::regclass and a.attname = 'id' and not a.attisdropped;
