alter table public.orders
  add column if not exists payment_gateway text,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_signature text,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_gateway_payload jsonb;

create index if not exists orders_razorpay_order_id_idx
  on public.orders (razorpay_order_id);

create index if not exists orders_razorpay_payment_id_idx
  on public.orders (razorpay_payment_id);
