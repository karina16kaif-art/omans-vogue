begin;
set local lock_timeout = '5s';

-- Existing rows start as published. Availability and archival keep their original meanings.
alter table public.products
  add column if not exists published boolean not null default true,
  add column if not exists bestseller_featured boolean not null default false;
alter table public.brand_settings
  add column if not exists settings_revision uuid not null default pg_catalog.gen_random_uuid();

create index if not exists omans_products_published_id
  on public.products (id) where archived_at is null and published;

-- Run before inventory reservation and hold the same product row locks until commit.
-- This closes the gap between quoting a published product and inserting the order.
create or replace function public.omans_assert_published_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_id bigint;
begin
  for product_id in
    select distinct (item->>'productId')::bigint
    from pg_catalog.jsonb_array_elements(new.items::jsonb) as lines(item)
    order by 1
  loop
    perform 1 from public.products where id = product_id and published for update;
    if not found then raise exception 'omans_checkout_catalogue_changed'; end if;
  end loop;
  return new;
end
$$;

revoke all on function public.omans_assert_published_order() from PUBLIC, anon, authenticated;
grant execute on function public.omans_assert_published_order() to service_role;
drop trigger if exists omans_assert_published_order on public.orders;
create trigger omans_assert_published_order after insert on public.orders
for each row when (new.checkout_request_id is not null) execute function public.omans_assert_published_order();

-- Preserve historical paid sales. A merchant feature flag never changes the actual ranking.
create or replace function public.omans_confirmed_bestsellers()
returns table (product_id text, units bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id::text, sum((l.item->>'quantity')::bigint)::bigint
  from public.orders o
  cross join lateral pg_catalog.jsonb_array_elements(
    case when pg_catalog.jsonb_typeof(o.items::jsonb) = 'array' then o.items::jsonb else '[]'::jsonb end
  ) l(item)
  join public.products p on p.id::text = coalesce(l.item->>'productId', l.item->>'id')
  where o.admin_payment_verified_at is not null and p.archived_at is null and p.published
    and (l.item->>'quantity') ~ '^[1-9][0-9]{0,8}$'
  group by p.id
  order by sum((l.item->>'quantity')::bigint) desc, p.id
  limit 24;
$$;

notify pgrst, 'reload schema';
commit;
