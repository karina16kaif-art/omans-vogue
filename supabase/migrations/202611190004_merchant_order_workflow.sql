begin;
set local lock_timeout = '5s';

create sequence if not exists public.omans_order_number_seq as bigint;
revoke all on sequence public.omans_order_number_seq from public, anon, authenticated, service_role;
grant usage on sequence public.omans_order_number_seq to service_role;

alter table public.delivery_quotes
  add column if not exists order_number bigint,
  add column if not exists merchant_status text,
  add column if not exists merchant_history jsonb not null default '[]'::jsonb;
alter table public.orders
  add column if not exists order_number bigint,
  add column if not exists merchant_status text,
  add column if not exists merchant_history jsonb not null default '[]'::jsonb;

update public.delivery_quotes
set order_number = coalesce(order_number, nextval('public.omans_order_number_seq')),
    merchant_status = coalesce(merchant_status, case when approved_at is null then 'Awaiting Delivery Fee' else 'Awaiting Payment' end)
where order_number is null or merchant_status is null;

update public.orders o
set order_number = coalesce(o.order_number,
      (select q.order_number from public.delivery_quotes q where q.id = o.delivery_quote_id),
      nextval('public.omans_order_number_seq')),
    merchant_status = coalesce(o.merchant_status, case lower(btrim(coalesce(
      case when o.checkout_request_id is null and lower(coalesce(o.status, 'pending')) in ('pending', 'new')
        then o.order_status else o.status end, o.order_status, 'pending')))
      when 'cancelled' then 'Cancelled'
      when 'canceled' then 'Cancelled'
      when 'delivered' then 'Delivered'
      when 'processing' then 'Processing'
      when 'confirmed' then 'Confirmed'
      when 'ready for pickup' then 'Ready for Pickup'
      when 'out for delivery' then 'Out for Delivery'
      else case when coalesce(btrim(o.payment_reference), '') <> '' or o.admin_payment_verified_at is not null
        then 'Payment Verification' else 'Pending Merchant Review' end end)
where o.order_number is null or o.merchant_status is null;

alter table public.delivery_quotes alter column order_number set not null, alter column merchant_status set not null;
alter table public.orders alter column order_number set not null, alter column merchant_status set not null;
create unique index if not exists omans_delivery_purchase_number_key on public.delivery_quotes (order_number);
create unique index if not exists omans_saved_order_number_key on public.orders (order_number);

create or replace function public.omans_assert_delivery_quote()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  approved public.delivery_quotes%rowtype;
begin
  if new.delivery_quote_id is null then
    if new.fulfilment_method = 'outside_campus' then raise exception 'omans_delivery_quote_invalid'; end if;
    return new;
  end if;
  -- Take the exclusive row lock first, including for concurrent retries.
  select * into approved from public.delivery_quotes where id = new.delivery_quote_id for update;
  if not found or approved.merchant_status <> 'Awaiting Payment'
    or approved.approved_at is null or approved.expires_at <= pg_catalog.clock_timestamp()
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

create or replace function public.omans_merchant_event(kind text, old_value text, new_value text, actor text)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
  select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'kind', kind, 'from', old_value, 'to', new_value, 'actor', actor, 'at', pg_catalog.clock_timestamp()
  ))
$$;

create or replace function public.omans_delivery_purchase_workflow()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.approved_at is not null then raise exception 'omans_workflow_invalid'; end if;
    new.order_number := pg_catalog.nextval('public.omans_order_number_seq');
    new.merchant_status := 'Awaiting Delivery Fee';
    new.merchant_history := public.omans_merchant_event('status', null, new.merchant_status, 'customer');
    return new;
  end if;

  new.order_number := old.order_number;
  new.merchant_history := old.merchant_history;
  if new.merchant_status is not distinct from old.merchant_status
    and new.approved_at is not distinct from old.approved_at
    and new.delivery_fee is not distinct from old.delivery_fee
    and new.expires_at is not distinct from old.expires_at then
    return new;
  end if;
  if old.merchant_status = 'Cancelled'
    or exists (select 1 from public.orders o where o.delivery_quote_id = old.id) then
    raise exception 'omans_workflow_invalid';
  end if;

  if old.approved_at is null and new.approved_at is not null then
    if old.merchant_status not in ('Pending Merchant Review','Awaiting Delivery Fee') then
      raise exception 'omans_workflow_invalid';
    end if;
    new.merchant_status := 'Awaiting Payment';
    new.merchant_history := new.merchant_history || public.omans_merchant_event(
      'delivery fee', null, new.delivery_fee::text, 'merchant');
  elsif new.approved_at is distinct from old.approved_at
    or new.delivery_fee is distinct from old.delivery_fee
    or new.expires_at is distinct from old.expires_at
    or new.merchant_status not in ('Pending Merchant Review','Awaiting Delivery Fee','Cancelled')
    or (old.approved_at is not null and new.merchant_status <> 'Cancelled') then
    raise exception 'omans_workflow_invalid';
  end if;

  if new.merchant_status is distinct from old.merchant_status then
    new.merchant_history := new.merchant_history || public.omans_merchant_event(
      'status', old.merchant_status, new.merchant_status, 'merchant');
  end if;
  return new;
end
$$;

create or replace function public.omans_saved_order_workflow()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  approved public.delivery_quotes%rowtype;
  prior_status text;
begin
  if tg_op = 'INSERT' then
    if new.admin_payment_verified_at is not null or lower(coalesce(new.payment_status, '')) = 'paid' then
      raise exception 'omans_workflow_invalid';
    end if;
    if new.delivery_quote_id is not null then
      -- The preceding delivery quote trigger has locked and validated the request.
      select * into approved from public.delivery_quotes q where q.id = new.delivery_quote_id;
      if not found or approved.merchant_status <> 'Awaiting Payment' then raise exception 'omans_workflow_invalid'; end if;
      new.order_number := approved.order_number;
      prior_status := approved.merchant_status;
    else
      new.order_number := pg_catalog.nextval('public.omans_order_number_seq');
    end if;
    new.merchant_status := case when coalesce(btrim(new.payment_reference), '') <> ''
      then 'Payment Verification' else 'Pending Merchant Review' end;
    new.merchant_history := public.omans_merchant_event('status', prior_status, new.merchant_status, 'customer');
    return new;
  end if;

  new.order_number := old.order_number;
  new.merchant_history := old.merchant_history;
  if new.delivery_quote_id is distinct from old.delivery_quote_id then raise exception 'omans_workflow_invalid'; end if;

  if new.admin_payment_verified_at is distinct from old.admin_payment_verified_at then
    if new.admin_payment_verified_at is null or old.admin_payment_verified_at is not null
      or coalesce(btrim(old.payment_reference), '') = '' or old.merchant_status = 'Cancelled'
      or lower(coalesce(new.payment_status, '')) <> 'paid'
      or new.merchant_status is distinct from old.merchant_status then
      raise exception 'omans_workflow_invalid';
    end if;
    new.admin_payment_verified_at := pg_catalog.clock_timestamp();
    new.merchant_history := new.merchant_history || public.omans_merchant_event('payment', 'Unverified', 'Verified', 'merchant');
  elsif new.payment_status is distinct from old.payment_status
    and (lower(coalesce(new.payment_status, '')) = 'paid' or old.admin_payment_verified_at is not null) then
    raise exception 'omans_workflow_invalid';
  end if;

  -- Honor safe writes from the previous dashboard during the rollout window.
  if new.merchant_status is not distinct from old.merchant_status
    and (new.status is distinct from old.status or new.order_status is distinct from old.order_status) then
    new.merchant_status := case lower(btrim(coalesce(new.status, new.order_status, '')))
      when 'processing' then 'Processing' when 'out for delivery' then 'Out for Delivery'
      when 'delivered' then 'Delivered' when 'cancelled' then 'Cancelled'
      when 'pending' then 'Pending Merchant Review' else old.merchant_status end;
  end if;

  if new.merchant_status is distinct from old.merchant_status then
    if old.merchant_status in ('Delivered','Cancelled')
      or new.merchant_status not in ('Pending Merchant Review','Awaiting Payment','Payment Verification',
        'Confirmed','Processing','Ready for Pickup','Out for Delivery','Delivered','Cancelled')
      or (new.merchant_status in ('Confirmed','Processing','Ready for Pickup','Out for Delivery','Delivered')
        and (old.admin_payment_verified_at is null or lower(coalesce(old.payment_status, '')) <> 'paid'))
      or (new.merchant_status in ('Pending Merchant Review','Awaiting Payment','Payment Verification','Confirmed')
        and old.merchant_status not in ('Pending Merchant Review','Awaiting Payment','Payment Verification'))
      or (new.merchant_status in ('Awaiting Payment','Payment Verification') and old.admin_payment_verified_at is not null)
      or (new.merchant_status = 'Payment Verification' and coalesce(btrim(old.payment_reference), '') = '')
      or (new.merchant_status = 'Processing' and old.merchant_status <> 'Confirmed')
      or (new.merchant_status in ('Ready for Pickup','Out for Delivery') and old.merchant_status not in ('Confirmed','Processing'))
      or (new.merchant_status = 'Ready for Pickup' and old.fulfilment_method is distinct from 'pickup')
      or (new.merchant_status = 'Out for Delivery' and old.fulfilment_method is distinct from 'delivery')
      or (new.merchant_status = 'Delivered' and old.merchant_status is distinct from
        case when old.fulfilment_method = 'pickup' then 'Ready for Pickup' else 'Out for Delivery' end) then
      raise exception 'omans_workflow_invalid';
    end if;
    new.merchant_history := new.merchant_history || public.omans_merchant_event(
      'status', old.merchant_status, new.merchant_status, 'merchant');
  end if;
  return new;
end
$$;

revoke all on function public.omans_merchant_event(text,text,text,text), public.omans_delivery_purchase_workflow(),
  public.omans_saved_order_workflow() from public, anon, authenticated;
grant execute on function public.omans_merchant_event(text,text,text,text), public.omans_delivery_purchase_workflow(),
  public.omans_saved_order_workflow() to service_role;

drop trigger if exists omans_delivery_purchase_workflow on public.delivery_quotes;
create trigger omans_delivery_purchase_workflow before insert or update on public.delivery_quotes
  for each row execute function public.omans_delivery_purchase_workflow();
drop trigger if exists omans_saved_order_workflow on public.orders;
create trigger omans_saved_order_workflow before insert or update on public.orders
  for each row execute function public.omans_saved_order_workflow();

commit;
