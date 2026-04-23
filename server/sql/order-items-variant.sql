-- Add variant_label to order_items for tracking which variant was ordered
alter table order_items add column if not exists variant_label text;
