-- Per-user notification preferences
create table if not exists notification_preferences (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  order_updates  boolean not null default true,
  service_updates boolean not null default true,
  promotional    boolean not null default true,
  back_in_stock  boolean not null default true,
  price_drops    boolean not null default true,
  new_arrivals   boolean not null default false,
  updated_at     timestamptz not null default now()
);

alter table notification_preferences enable row level security;
create policy "notif_prefs_own" on notification_preferences
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
