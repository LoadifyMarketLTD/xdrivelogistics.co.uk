BEGIN;

INSERT INTO public.app_settings (key, value)
VALUES ('onboarding_token_ttl_hours', '48')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

CREATE INDEX IF NOT EXISTS onboarding_applications_user_token_state_idx
  ON public.onboarding_applications (user_id, token_expires_at, token_last_sent_at);

COMMENT ON COLUMN public.onboarding_applications.token_expires_at IS
  'Expiry of the current onboarding invitation token. XDrive defaults this to 48 hours.';

COMMIT;
