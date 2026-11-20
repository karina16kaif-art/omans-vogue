begin;
set local lock_timeout = '5s';

-- Match the existing numeric product and order totals. Keep the positive-subtotal
-- constraint and retain the exact stored value on every existing delivery request.
alter table public.delivery_quotes alter column subtotal type numeric;

commit;
