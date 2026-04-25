-- Stores the live location broadcast by a technician's device.
-- Upserted on every GPS tick; one row per technician.
create table if not exists technician_locations (
  technician_id uuid        primary key references technicians(id) on delete cascade,
  lat           float8      not null,
  lng           float8      not null,
  heading       float4,                    -- degrees 0–360, nullable
  speed_kmh     float4,                    -- km/h, nullable
  updated_at    timestamptz not null default now()
);

alter table technician_locations enable row level security;

-- Technicians write their own location
create policy "technicians update own location"
  on technician_locations for all
  using  ((select auth.uid()) = technician_id)
  with check ((select auth.uid()) = technician_id);

-- Authenticated customers can read any technician location
create policy "authenticated read technician locations"
  on technician_locations for select
  using (auth.role() = 'authenticated');

-- Supabase Realtime: enable publication so the customer app can subscribe
alter publication supabase_realtime add table technician_locations;

-- ── Helper: update or insert technician location ───────────────────────
-- Called by the technician's app on each GPS tick.
create or replace function upsert_technician_location(
  p_lat     float8,
  p_lng     float8,
  p_heading float4 default null,
  p_speed   float4 default null
)
returns void
language sql
security definer
as $$
  insert into technician_locations(technician_id, lat, lng, heading, speed_kmh, updated_at)
    values (auth.uid(), p_lat, p_lng, p_heading, p_speed, now())
    on conflict (technician_id)
    do update set
      lat        = excluded.lat,
      lng        = excluded.lng,
      heading    = excluded.heading,
      speed_kmh  = excluded.speed_kmh,
      updated_at = now();
$$;

grant execute on function upsert_technician_location(float8, float8, float4, float4) to authenticated;
