-- Service / Technician Ratings (#12)
-- Run once in Supabase SQL Editor

create table if not exists service_reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references service_bookings(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  rating      smallint not null check (rating between 1 and 5),
  tags        text[]   default '{}',
  review_text text,
  created_at  timestamptz default now()
);

alter table service_reviews enable row level security;

-- Anyone can read reviews (for showing on technician profiles later)
create policy "public_read_service_reviews"
  on service_reviews for select using (true);

-- Authenticated users can insert their own review
create policy "auth_insert_service_review"
  on service_reviews for insert
  with check (auth.uid() = user_id);

-- Users can update their own review
create policy "auth_update_service_review"
  on service_reviews for update
  using (auth.uid() = user_id);
