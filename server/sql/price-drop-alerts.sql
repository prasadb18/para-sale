create table if not exists price_drop_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  product_id   text not null,
  alert_price  numeric(12,2) not null,  -- price at time of alert creation
  notified     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table price_drop_alerts enable row level security;

create policy "users manage own price alerts"
  on price_drop_alerts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_price_drop_product
  on price_drop_alerts (product_id)
  where notified = false;
