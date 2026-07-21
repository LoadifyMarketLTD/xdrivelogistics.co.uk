BEGIN;

-- The normalized staging history may contain the earlier Fleet Driver migration
-- even when the physical relation is absent after a history repair. Recreate the
-- relation idempotently before exposing it through PostgREST.
CREATE TABLE IF NOT EXISTS public.fleet_driver_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  token_hash text,
  status text NOT NULL DEFAULT 'invited',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_driver_invitations
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS invited_email text,
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'invited',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '48 hours'),
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.fleet_driver_invitations
SET invited_email = lower(trim(invited_email)),
    status = COALESCE(status, 'invited'),
    expires_at = COALESCE(expires_at, now() + interval '48 hours'),
    last_sent_at = COALESCE(last_sent_at, now()),
    created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, now())
WHERE invited_email IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fleet_driver_invitations_status_check'
      AND conrelid = 'public.fleet_driver_invitations'::regclass
  ) THEN
    ALTER TABLE public.fleet_driver_invitations
      ADD CONSTRAINT fleet_driver_invitations_status_check
      CHECK (status IN ('invited', 'accepted', 'approved', 'revoked', 'expired')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fleet_driver_invitations_email_normalized'
      AND conrelid = 'public.fleet_driver_invitations'::regclass
  ) THEN
    ALTER TABLE public.fleet_driver_invitations
      ADD CONSTRAINT fleet_driver_invitations_email_normalized
      CHECK (invited_email = lower(trim(invited_email))) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fleet_driver_invitations_accepted_at_check'
      AND conrelid = 'public.fleet_driver_invitations'::regclass
  ) THEN
    ALTER TABLE public.fleet_driver_invitations
      ADD CONSTRAINT fleet_driver_invitations_accepted_at_check
      CHECK (status NOT IN ('accepted', 'approved') OR accepted_at IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fleet_driver_invitations_approved_at_check'
      AND conrelid = 'public.fleet_driver_invitations'::regclass
  ) THEN
    ALTER TABLE public.fleet_driver_invitations
      ADD CONSTRAINT fleet_driver_invitations_approved_at_check
      CHECK (status <> 'approved' OR approved_at IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fleet_driver_invitations_revoked_at_check'
      AND conrelid = 'public.fleet_driver_invitations'::regclass
  ) THEN
    ALTER TABLE public.fleet_driver_invitations
      ADD CONSTRAINT fleet_driver_invitations_revoked_at_check
      CHECK (status <> 'revoked' OR revoked_at IS NOT NULL) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.fleet_driver_invitations
  VALIDATE CONSTRAINT fleet_driver_invitations_status_check;
ALTER TABLE public.fleet_driver_invitations
  VALIDATE CONSTRAINT fleet_driver_invitations_email_normalized;
ALTER TABLE public.fleet_driver_invitations
  VALIDATE CONSTRAINT fleet_driver_invitations_accepted_at_check;
ALTER TABLE public.fleet_driver_invitations
  VALIDATE CONSTRAINT fleet_driver_invitations_approved_at_check;
ALTER TABLE public.fleet_driver_invitations
  VALIDATE CONSTRAINT fleet_driver_invitations_revoked_at_check;

CREATE UNIQUE INDEX IF NOT EXISTS fleet_driver_invitations_driver_uidx
  ON public.fleet_driver_invitations (driver_id);
CREATE UNIQUE INDEX IF NOT EXISTS fleet_driver_invitations_token_hash_uidx
  ON public.fleet_driver_invitations (token_hash)
  WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS fleet_driver_invitations_company_status_idx
  ON public.fleet_driver_invitations (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS fleet_driver_invitations_user_status_idx
  ON public.fleet_driver_invitations (user_id, status, expires_at DESC);

ALTER TABLE public.fleet_driver_invitations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.fleet_driver_invitations
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.fleet_driver_invitations
  TO service_role;
REVOKE ALL ON TABLE public.fleet_driver_invitations FROM anon;

DROP POLICY IF EXISTS fleet_driver_invitations_deny_authenticated
  ON public.fleet_driver_invitations;
CREATE POLICY fleet_driver_invitations_deny_authenticated
  ON public.fleet_driver_invitations
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DO $$
BEGIN
  IF to_regclass('public.fleet_driver_invitations') IS NULL THEN
    RAISE EXCEPTION 'Fleet Driver invitation table reconciliation failed.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
