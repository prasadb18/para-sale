-- Help & Support Tickets (#30)
-- Run once in Supabase SQL Editor

create table if not exists support_tickets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  email      text,
  subject    text not null,
  message    text not null,
  status     text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table support_tickets enable row level security;

-- Users can insert their own tickets (guests allowed — user_id nullable)
create policy "anyone_insert_ticket"
  on support_tickets for insert with check (true);

-- Users can read only their own tickets
create policy "own_tickets_select"
  on support_tickets for select
  using (auth.uid() = user_id);
