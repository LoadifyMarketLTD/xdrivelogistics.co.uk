-- Task 8: Canonical Android FCM token lifecycle registry.
-- Owner/session isolation: each token is registered server-side to one owner/driver
-- at a time and can be revoked on logout/session rotation.

CREATE TABLE IF NOT EXISTS public.driver_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  app_package text,
  last_registered_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_device_tokens_platform_check CHECK (platform IN ('android'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'driver_device_tokens_token_unique'
      AND conrelid = 'public.driver_device_tokens'::regclass
  ) THEN
    ALTER TABLE public.driver_device_tokens
      ADD CONSTRAINT driver_device_tokens_token_unique UNIQUE (token);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_driver_device_tokens_owner_driver_active
  ON public.driver_device_tokens (user_id, driver_id, updated_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_driver_device_tokens_driver_active
  ON public.driver_device_tokens (driver_id, updated_at DESC)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_device_tokens TO service_role;
GRANT SELECT ON public.driver_device_tokens TO authenticated;

NOTIFY pgrst, 'reload schema';
