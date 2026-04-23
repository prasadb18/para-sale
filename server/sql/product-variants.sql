-- Product Variants table
-- Supports a single attribute group per product (e.g. Size, Color, Capacity)
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  attribute_name text not null default 'Variant', -- e.g. 'Size', 'Color', 'Capacity'
  value text not null,                             -- e.g. '1.5mm', 'White', '6A'
  price numeric not null,
  mrp numeric,
  stock integer not null default 0,
  sku text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists product_variants_product_id_idx on product_variants(product_id);

-- RLS
alter table product_variants enable row level security;
create policy "variants_select_public" on product_variants for select using (true);
create policy "variants_insert_admin"  on product_variants for insert with check (auth.role() = 'authenticated');
create policy "variants_update_admin"  on product_variants for update using (auth.role() = 'authenticated');
create policy "variants_delete_admin"  on product_variants for delete using (auth.role() = 'authenticated');
