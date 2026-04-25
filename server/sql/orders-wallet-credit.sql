-- Add support for wallet credit used on an order.
alter table if exists orders
  add column if not exists wallet_credit numeric(12,2) default 0;
