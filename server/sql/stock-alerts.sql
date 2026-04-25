-- Back In Stock Alerts (#13)
-- Run once in Supabase SQL Editor

create table if not exists stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  text not null,
  variant_id  text,
  notified    boolean default false,
  created_at  timestamptz default now(),
  unique (user_id, product_id, variant_id)
);

alter table stock_alerts enable row level security;

create policy "own_stock_alerts"
  on stock_alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for admin/backend to query pending alerts by product
create index if not exists stock_alerts_product_idx on stock_alerts(product_id) where notified = false;
