CREATE TABLE IF NOT EXISTS public.return_requests (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  reason      text        NOT NULL,
  description text,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_return_requests" ON public.return_requests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS return_requests_order_idx
  ON public.return_requests (order_id);
