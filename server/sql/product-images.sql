-- Add multiple images support to products
-- Run this in Supabase SQL editor

alter table products
  add column if not exists images text[] default '{}';

-- Backfill: copy existing image_url into the images array for all products that have one
update products
  set images = array[image_url]
  where image_url is not null
    and (images is null or array_length(images, 1) is null);
