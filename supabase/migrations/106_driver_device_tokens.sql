-- Migration 106: driver device tokens for push notifications
-- Stores Expo push tokens (or APNs/FCM tokens) per driver per platform.
-- Unique constraint on (driver_id, platform) so upsert replaces stale tokens.

CREATE TABLE IF NOT EXISTS public.driver_device_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  token       text NOT NULL,
  platform    text NOT NULL DEFAULT 'expo' CHECK (platform IN ('ios', 'android', 'expo')),
  app_version text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_device_tokens_driver_platform_key UNIQUE (driver_id, platform)
);

ALTER TABLE public.driver_device_tokens ENABLE ROW LEVEL SECURITY;

-- Drivers can only read/manage their own tokens
CREATE POLICY driver_device_tokens_self
  ON public.driver_device_tokens
  FOR ALL
  USING (user_id = auth.uid());
