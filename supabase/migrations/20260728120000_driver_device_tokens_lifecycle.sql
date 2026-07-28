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
  -- Stable random UUID generated once per device install. Used together with
  -- registration_generation to detect and reject stale cross-session writes: a
  -- delayed request from owner A must not overwrite a newer registration from
  -- owner B who signed in on the same device after A.
  installation_id text NOT NULL DEFAULT '',
  -- Monotonically-increasing counter persisted in the on-device coordinator.
  -- The server rejects any upsert whose generation is less than or equal to the
  -- generation already stored for the same installation, including revoked
  -- rows, so delayed old requests cannot re-activate stale ownership.
  registration_generation bigint NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_driver_device_tokens_installation_generation
  ON public.driver_device_tokens (installation_id, registration_generation DESC, updated_at DESC);

CREATE OR REPLACE FUNCTION public.driver_register_device_token_atomic(
  p_user_id uuid,
  p_driver_id uuid,
  p_company_id uuid,
  p_token text,
  p_platform text,
  p_app_package text,
  p_installation_id text,
  p_generation bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_current record;
BEGIN
  IF p_generation <= 0 THEN
    RETURN 'stale';
  END IF;

  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN 'stale';
  END IF;

  IF p_installation_id IS NULL OR btrim(p_installation_id) = '' THEN
    RETURN 'stale';
  END IF;

  -- Serialize all writes for this installation and this token to prevent
  -- check-then-mutate races under concurrent A/B requests.
  PERFORM pg_advisory_xact_lock(hashtext('driver_device_tokens:install:' || p_installation_id));
  PERFORM pg_advisory_xact_lock(hashtext('driver_device_tokens:token:' || p_token));

  SELECT
    user_id,
    driver_id,
    token,
    platform,
    app_package,
    installation_id,
    registration_generation
  INTO v_current
  FROM public.driver_device_tokens
  WHERE installation_id = p_installation_id
  ORDER BY registration_generation DESC, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF p_generation < v_current.registration_generation THEN
      RETURN 'stale';
    END IF;

    IF p_generation = v_current.registration_generation THEN
      IF v_current.user_id = p_user_id
        AND v_current.driver_id = p_driver_id
        AND v_current.token = p_token
        AND v_current.platform = p_platform
        AND COALESCE(v_current.app_package, '') = COALESCE(p_app_package, '')
        AND v_current.installation_id = p_installation_id
      THEN
        RETURN 'duplicate';
      END IF;
      RETURN 'stale';
    END IF;
  END IF;

  -- Revoke any previous active token owned by this installation.
  UPDATE public.driver_device_tokens
  SET revoked_at = v_now,
      updated_at = v_now
  WHERE installation_id = p_installation_id
    AND revoked_at IS NULL
    AND token <> p_token;

  -- Revoke other active tokens owned by the same owner/driver pair.
  UPDATE public.driver_device_tokens
  SET revoked_at = v_now,
      updated_at = v_now
  WHERE user_id = p_user_id
    AND driver_id = p_driver_id
    AND revoked_at IS NULL
    AND token <> p_token;

  -- Revoke active ownership of this token from any different owner/driver/install.
  UPDATE public.driver_device_tokens
  SET revoked_at = v_now,
      updated_at = v_now
  WHERE token = p_token
    AND revoked_at IS NULL
    AND (
      user_id <> p_user_id OR
      driver_id <> p_driver_id OR
      installation_id <> p_installation_id
    );

  INSERT INTO public.driver_device_tokens (
    user_id,
    driver_id,
    company_id,
    token,
    platform,
    app_package,
    installation_id,
    registration_generation,
    last_registered_at,
    revoked_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_driver_id,
    p_company_id,
    p_token,
    p_platform,
    p_app_package,
    p_installation_id,
    p_generation,
    v_now,
    NULL,
    v_now,
    v_now
  )
  ON CONFLICT (token) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      driver_id = EXCLUDED.driver_id,
      company_id = EXCLUDED.company_id,
      platform = EXCLUDED.platform,
      app_package = EXCLUDED.app_package,
      installation_id = EXCLUDED.installation_id,
      registration_generation = EXCLUDED.registration_generation,
      last_registered_at = EXCLUDED.last_registered_at,
      revoked_at = NULL,
      updated_at = v_now;

  UPDATE public.drivers
  SET device_token = p_token
  WHERE id = p_driver_id
    AND user_id = p_user_id;

  RETURN 'accepted';
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_unregister_device_token_atomic(
  p_user_id uuid,
  p_driver_id uuid,
  p_token text,
  p_installation_id text,
  p_generation bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_current record;
BEGIN
  IF p_generation <= 0 THEN
    RETURN 'stale';
  END IF;

  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN 'stale';
  END IF;

  IF p_installation_id IS NULL OR btrim(p_installation_id) = '' THEN
    RETURN 'stale';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('driver_device_tokens:install:' || p_installation_id));
  PERFORM pg_advisory_xact_lock(hashtext('driver_device_tokens:token:' || p_token));

  SELECT
    user_id,
    driver_id,
    token,
    installation_id,
    registration_generation,
    revoked_at
  INTO v_current
  FROM public.driver_device_tokens
  WHERE installation_id = p_installation_id
  ORDER BY registration_generation DESC, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'duplicate';
  END IF;

  IF p_generation < v_current.registration_generation THEN
    RETURN 'stale';
  END IF;

  IF p_generation = v_current.registration_generation AND (
    v_current.user_id <> p_user_id OR
    v_current.driver_id <> p_driver_id OR
    v_current.token <> p_token OR
    v_current.installation_id <> p_installation_id
  ) THEN
    RETURN 'stale';
  END IF;

  IF v_current.revoked_at IS NULL AND
     v_current.user_id = p_user_id AND
     v_current.driver_id = p_driver_id AND
     v_current.token = p_token AND
     v_current.installation_id = p_installation_id AND
     v_current.registration_generation = p_generation
  THEN
    UPDATE public.driver_device_tokens
    SET revoked_at = v_now,
        updated_at = v_now
    WHERE token = p_token
      AND installation_id = p_installation_id
      AND registration_generation = p_generation
      AND user_id = p_user_id
      AND driver_id = p_driver_id
      AND revoked_at IS NULL;

    UPDATE public.drivers
    SET device_token = NULL
    WHERE id = p_driver_id
      AND user_id = p_user_id
      AND device_token = p_token;

    RETURN 'accepted';
  END IF;

  RETURN 'duplicate';
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_device_tokens TO service_role;
-- Authenticated clients must not directly enumerate device tokens; all reads and
-- mutations are performed via service-role server API routes only.
REVOKE ALL ON public.driver_device_tokens FROM authenticated;

REVOKE ALL ON FUNCTION public.driver_register_device_token_atomic(uuid, uuid, uuid, text, text, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_register_device_token_atomic(uuid, uuid, uuid, text, text, text, text, bigint) TO service_role;
REVOKE ALL ON FUNCTION public.driver_unregister_device_token_atomic(uuid, uuid, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_unregister_device_token_atomic(uuid, uuid, text, text, bigint) TO service_role;

-- Row-level security enforced: no authenticated policy is intentionally defined.
-- The service_role bypass ensures server-side operations remain unaffected.
ALTER TABLE public.driver_device_tokens ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
