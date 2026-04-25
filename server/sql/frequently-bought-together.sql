-- Returns product IDs most frequently co-purchased with a given product.
-- Falls back gracefully when there are no co-purchase records.
create or replace function get_frequently_bought_together(
  p_product_id text,
  p_limit      int default 5
)
returns table(product_id text, frequency bigint)
language sql
security definer
stable
as $$
  select oi2.product_id::text, count(*) as frequency
  from   order_items oi1
  join   order_items oi2
    on   oi2.order_id = oi1.order_id
   and   oi2.product_id::text <> p_product_id
  where  oi1.product_id::text = p_product_id
  group  by oi2.product_id
  order  by frequency desc
  limit  p_limit;
$$;

grant execute on function get_frequently_bought_together(text, int) to anon, authenticated;
