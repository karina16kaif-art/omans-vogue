begin;

set local lock_timeout = '5s';

alter table public.brand_settings
  add column if not exists momo_payment_instructions text not null default '';

commit;
