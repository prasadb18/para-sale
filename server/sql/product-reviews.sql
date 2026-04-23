-- Product Reviews Table
-- Run this in Supabase SQL editor

create table if not exists product_reviews (
  id           uuid    default gen_random_uuid() primary key,
  product_id   uuid    not null references products(id) on delete cascade,
  user_id      uuid    not null references auth.users(id) on delete cascade,
  rating       integer not null check (rating between 1 and 5),
  review_text  text,
  reviewer_name text,
  created_at   timestamptz default now()
);

-- One review per user per product
create unique index if not exists idx_product_reviews_unique
  on product_reviews(product_id, user_id);

create index if not exists idx_product_reviews_product_id
  on product_reviews(product_id);

-- RLS
alter table product_reviews enable row level security;

create policy "Anyone can view reviews"
  on product_reviews for select using (true);

create policy "Authenticated users can insert own reviews"
  on product_reviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reviews"
  on product_reviews for update
  using (auth.uid() = user_id);

create policy "Users can delete own reviews"
  on product_reviews for delete
  using (auth.uid() = user_id);
