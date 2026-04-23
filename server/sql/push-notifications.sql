-- Add push_token column to profiles so the backend can send targeted notifications
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Index for quick lookups when webhook fires
CREATE INDEX IF NOT EXISTS profiles_push_token_idx
  ON public.profiles (push_token)
  WHERE push_token IS NOT NULL;
