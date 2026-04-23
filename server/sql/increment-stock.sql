-- Inverse of decrement_stock — used when an order is cancelled
CREATE OR REPLACE FUNCTION increment_stock(product_id uuid, qty int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE products
  SET stock = stock + qty
  WHERE id = product_id;
$$;

GRANT EXECUTE ON FUNCTION increment_stock(uuid, int) TO authenticated, anon;
