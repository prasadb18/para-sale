-- Profile name + phone (pre-fills checkout)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone     text;

-- Saved delivery addresses
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      text        NOT NULL DEFAULT 'Home',
  full_name  text        NOT NULL,
  phone      text        NOT NULL,
  line1      text        NOT NULL,
  line2      text,
  city       text        NOT NULL,
  pincode    text        NOT NULL,
  is_default boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_addresses" ON public.user_addresses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_addresses_user_idx
  ON public.user_addresses (user_id, created_at DESC);
