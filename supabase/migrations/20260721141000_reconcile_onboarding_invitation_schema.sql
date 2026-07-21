BEGIN;

-- A disposable staging history can report the earlier invitation migration as
-- applied even when the physical column is absent after a normalized-history
-- repair. Reconcile the physical schema idempotently and fail the migration if
-- the required invitation controls are still unavailable.
ALTER TABLE public.onboarding_applications
  ADD COLUMN IF NOT EXISTS token_revoked_at timestamptz;

INSERT INTO public.app_settings (key, value)
VALUES ('onboarding_token_ttl_hours', '48')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

CREATE INDEX IF NOT EXISTS onboarding_applications_user_token_state_idx
  ON public.onboarding_applications (user_id, token_expires_at, token_last_sent_at, token_revoked_at);

COMMENT ON COLUMN public.onboarding_applications.token_expires_at IS
  'Expiry of the current onboarding invitation token. XDrive defaults this to 48 hours.';

COMMENT ON COLUMN public.onboarding_applications.token_revoked_at IS
  'When set, automatic resume token generation remains disabled until an explicit resend action.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'onboarding_applications'
      AND column_name = 'token_revoked_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION 'Invitation schema reconciliation failed: onboarding_applications.token_revoked_at is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_settings
    WHERE key = 'onboarding_token_ttl_hours'
      AND value = '48'
  ) THEN
    RAISE EXCEPTION 'Invitation schema reconciliation failed: onboarding token TTL is not 48 hours.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
