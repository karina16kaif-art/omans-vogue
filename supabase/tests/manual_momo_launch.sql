\set ON_ERROR_STOP on
-- Run with psql on a disposable empty PostgreSQL cluster only. Fixtures contain no customer data.
do $$
begin
  if to_regclass('public.orders') is not null or to_regclass('public.products') is not null
     or to_regclass('public.brand_settings') is not null or to_regclass('public.admin_credentials') is not null then
    raise exception 'This fixture requires an empty, disposable database.';
  end if;
  if exists (select 1 from pg_roles where rolname in ('anon', 'authenticated', 'service_role')) then
    raise exception 'Use a disposable cluster with no Supabase roles.';
  end if;
end
$$;

create role anon;
create role authenticated;
create role service_role bypassrls;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table public.orders (
  id bigint generated always as identity primary key,
  customer_name text, customer_phone text, customer_email text, items jsonb,
  total numeric, status text default 'pending', created_at timestamptz default now(),
  delivery_phone text default '', delivery_address text default '', city_region text default '',
  total_amount numeric default 0, payment_method text default '', payment_status text default 'Pending',
  order_status text default 'Pending', hubtel jsonb, updated_at timestamptz default now(),
  fulfilment_method text not null default 'delivery', delivery_fee numeric not null default 0,
  payment_reference text not null default ''
);

create table public.products (
  id bigint primary key, name text, description text, category text, image_url text, price numeric,
  stock integer default 0, created_at timestamptz default now(), image text, in_stock boolean default true,
  stock_status text default 'in_stock', notes text, detailed_description text, updated_at timestamptz default now()
);
insert into public.products (id, name, price, stock, image_url, detailed_description)
select i, 'Fixture ' || i, 10.075, case i when 2 then 0 when 3 then null else 5 end,
       'https://example.invalid/legacy.webp', 'Legacy description'
from generate_series(1, 16) as i;

create table public.brand_settings (
  id bigint primary key, brand_name text, whatsapp_number text, hero_eyebrow text, hero_prefix text,
  hero_title text, hero_subtitle text, hero_background_url text, updated_at timestamptz default now(),
  hero_background_image text, hero_background_webp text, hero_headline_prefix text,
  momo_number text not null default '', momo_account_name text not null default '',
  pickup_location text not null default 'Jean Nelson Hostel, University of Ghana, Legon',
  delivery_fee numeric not null default 10
);
insert into public.brand_settings (id, brand_name, delivery_fee) values (1, 'Existing brand', 12.50);

\ir ../migrations/202611180001_manual_momo_checkout.sql
\ir ../migrations/202611180002_catalogue_and_inventory.sql
\ir ../migrations/202611180001_manual_momo_checkout.sql
\ir ../migrations/202611180002_catalogue_and_inventory.sql

do $$
begin
  if (select array_agg(id order by id) from public.products) <> array(select i::bigint from generate_series(1, 16) i)
     or exists (select 1 from public.products
       where price is distinct from 10.075 or image_url is distinct from 'https://example.invalid/legacy.webp'
          or detailed_description is distinct from 'Legacy description' or stock is distinct from stock_quantity)
     or (select stock_quantity from public.products where id=2) is distinct from 0
     or (select stock_quantity from public.products where id=3) is not null then
    raise exception 'Existing product IDs or attributes changed.';
  end if;
  if not exists (select 1 from public.brand_settings where id=1
    and brand_name='Existing brand' and delivery_fee=12.50 and campus_delivery_fee=12.50) then
    raise exception 'Existing brand settings were lost.';
  end if;
  if exists (
    select 1 from pg_class c cross join pg_roles r
    where c.oid in ('public.orders'::regclass, 'public.products'::regclass,
                    'public.brand_settings'::regclass, 'public.admin_credentials'::regclass)
      and r.rolname in ('anon', 'authenticated')
      and (not c.relrowsecurity or has_table_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE'))
  ) then
    raise exception 'An API role can access a protected table.';
  end if;
  if has_function_privilege('anon', 'public.omans_confirmed_bestsellers()', 'EXECUTE')
     or has_sequence_privilege('authenticated', 'public.products_id_seq', 'USAGE, SELECT, UPDATE') then
    raise exception 'An API role can use a private function or sequence.';
  end if;
end
$$;

set role service_role;
do $$
declare
  new_product_id bigint;
  order_id bigint;
  request_id uuid := '123e4567-e89b-42d3-a456-426614174000';
  cart jsonb := '[{"productId":1,"unitPrice":10.08,"quantity":1}]';
begin
  insert into public.products (name, price, stock, stock_quantity) values ('New fixture', 5, null, null)
    returning id into new_product_id;
  if new_product_id <> 17 then raise exception 'Expected bigint product ID 17, got %.', new_product_id; end if;

  update public.brand_settings set delivery_fee=10 where id=1;
  if (select campus_delivery_fee from public.brand_settings where id=1) is distinct from 10 then
    raise exception 'Delivery fee alias did not update.';
  end if;

  insert into public.orders (checkout_request_id, items, total, total_amount, fulfilment_method, delivery_fee, payment_reference, momo_phone)
  values (request_id, cart, 10.08, 10.08, 'pickup', 0, 'REF-FIXTURE', '+233240000000')
  returning id into order_id;
  if order_id <> 1 then raise exception 'Expected existing order sequence to issue ID 1.'; end if;

  insert into public.orders (checkout_request_id, items, total, fulfilment_method, delivery_fee, payment_reference, momo_phone)
  values (request_id, cart, 10.08, 'pickup', 0, 'REF-FIXTURE', '+233240000000')
  on conflict (checkout_request_id) do nothing;
  begin
    insert into public.orders (checkout_request_id, items, total, fulfilment_method, delivery_fee, payment_reference, momo_phone)
    values ('123e4567-e89b-42d3-a456-426614174001', cart, 10.08, 'pickup', 0, 'ref-fixture', '+233240000000');
    raise exception 'An already-used payment reference was accepted.';
  exception when unique_violation then
    null;
  end;
  if not exists (select 1 from public.products where id=1 and stock=4 and stock_quantity=4) then
    raise exception 'Order retry did not preserve synchronized inventory.';
  end if;
  if (select count(*) from public.orders) <> 1 or exists (select 1 from public.omans_confirmed_bestsellers()) then
    raise exception 'Duplicate checkout or unverified product sale.';
  end if;
  update public.orders set admin_payment_verified_at=now(), payment_status='Paid' where id=order_id;
  if not exists (select 1 from public.omans_confirmed_bestsellers() where product_id='1' and units=1) then
    raise exception 'Verified order missing from best sellers.';
  end if;
  if has_table_privilege(current_user, 'public.orders', 'DELETE, TRUNCATE') then
    raise exception 'The backend can delete orders or truncate the order table.';
  end if;
end
$$;
reset role;

select 'Production-schema compatibility fixture passed' as result;
