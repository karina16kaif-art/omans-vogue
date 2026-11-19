begin;
set local lock_timeout = '5s';

create table if not exists public.delivery_quotes (
  id uuid primary key,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  customer_name text not null check (length(customer_name) between 1 and 120),
  customer_phone text not null check (customer_phone ~ '^[+][1-9][0-9]{7,14}$'),
  customer_email text,
  area text not null check (length(area) between 1 and 120),
  address text not null check (length(address) between 1 and 300),
  landmark text not null check (length(landmark) between 1 and 180),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  subtotal numeric(14,2) not null check (subtotal > 0 and subtotal < 'Infinity'::numeric),
  whatsapp_number text not null check (whatsapp_number ~ '^[+][1-9][0-9]{7,14}$'),
  delivery_fee numeric(9,2) check (delivery_fee between 0 and 9999999.99),
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint omans_delivery_quote_approval check (
    (approved_at is null and expires_at is null and delivery_fee is null)
    or (approved_at is not null and expires_at is not null and expires_at > approved_at and delivery_fee is not null)
  )
);

alter table public.delivery_quotes enable row level security;
revoke all on table public.delivery_quotes from public, anon, authenticated, service_role;
grant select, insert, update on table public.delivery_quotes to service_role;
drop policy if exists backend_only_delivery_quotes on public.delivery_quotes;
create policy backend_only_delivery_quotes on public.delivery_quotes for all to service_role
using (true) with check (true);

create index if not exists omans_pending_delivery_quotes_idx
  on public.delivery_quotes (created_at desc, id desc) where approved_at is null;

alter table public.orders
  add column if not exists delivery_quote_id uuid references public.delivery_quotes(id);
create unique index if not exists omans_orders_delivery_quote_key
  on public.orders (delivery_quote_id) where delivery_quote_id is not null;

create or replace function public.omans_assert_delivery_quote()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  approved public.delivery_quotes%rowtype;
begin
  if new.delivery_quote_id is null then
    if new.fulfilment_method = 'outside_campus' then
      raise exception 'omans_delivery_quote_invalid';
    end if;
    return new;
  end if;

  select * into approved from public.delivery_quotes
    where id = new.delivery_quote_id for key share;
  if not found or approved.approved_at is null or approved.expires_at <= pg_catalog.clock_timestamp()
    or new.fulfilment_method is distinct from 'delivery'
    or new.delivery_fee is distinct from approved.delivery_fee
    or new.total is distinct from (approved.subtotal + approved.delivery_fee)
    or new.total_amount is distinct from new.total
    or new.items::jsonb is distinct from approved.items
    or new.checkout_request_id is null
    or coalesce(pg_catalog.btrim(new.payment_reference), '') = '' then
    raise exception 'omans_delivery_quote_invalid';
  end if;
  return new;
end
$$;

revoke all on function public.omans_assert_delivery_quote() from public, anon, authenticated;
grant execute on function public.omans_assert_delivery_quote() to service_role;
drop trigger if exists omans_assert_delivery_quote on public.orders;
create trigger omans_assert_delivery_quote before insert on public.orders
  for each row when (new.delivery_quote_id is not null or new.fulfilment_method = 'outside_campus')
  execute function public.omans_assert_delivery_quote();

commit;
