-- Migration 106: Driver device tokens table
-- Creates a dedicated table for storing push-notification device tokens,
-- replacing the single `device_token` text column on drivers.
-- Supports multiple devices per driver (mobile + web PWA).

BEGIN;

CREATE TABLE IF NOT EXISTS public.driver_device_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid        NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  token       text        NOT NULL,
  platform    text        NOT NULL DEFAULT 'web'
                            CHECK (platform IN ('ios', 'android', 'web')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (driver_id, token)
);

CREATE INDEX IF NOT EXISTS driver_device_tokens_driver_idx
  ON public.driver_device_tokens (driver_id);

-- RLS
ALTER TABLE public.driver_device_tokens ENABLE ROW LEVEL SECURITY;

-- Drivers can read and manage their own tokens
CREATE POLICY driver_device_tokens_own
  ON public.driver_device_tokens
  FOR ALL
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

-- Company admins / owners can read tokens for their drivers
CREATE POLICY driver_device_tokens_company_read
  ON public.driver_device_tokens
  FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM public.drivers
      WHERE company_id = public.auth_company_id()
    )
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
