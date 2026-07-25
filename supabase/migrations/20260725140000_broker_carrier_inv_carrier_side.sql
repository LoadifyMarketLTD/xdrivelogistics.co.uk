-- Migration: broker_carrier_inv_carrier_side
-- Adds:
--   1. 'rejected' to the status constraint so carriers can decline invitations.
--   2. A carrier-side SELECT policy so a carrier user can see invitations
--      addressed to their company_id or their auth email.
--
-- Idempotent: safe to run more than once.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ── 1. Add 'rejected' to the status constraint ────────────────────────────
DO $$
DECLARE
  c record;
BEGIN
  -- Drop the canonical target constraint if it already exists
  EXECUTE 'ALTER TABLE public.broker_carrier_invitations DROP CONSTRAINT IF EXISTS broker_carrier_inv_status_check';

  -- Drop any remaining legacy status check constraints on this table
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.broker_carrier_invitations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) ILIKE '%pending%'
      AND pg_get_constraintdef(oid) ILIKE '%accepted%'
      AND pg_get_constraintdef(oid) ILIKE '%revoked%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.broker_carrier_invitations DROP CONSTRAINT %I',
      c.conname
    );
  END LOOP;

  -- Recreate canonical constraint with 'rejected' included
  ALTER TABLE public.broker_carrier_invitations
    ADD CONSTRAINT broker_carrier_inv_status_check
    CHECK (status IN ('pending', 'accepted', 'revoked', 'rejected'));
END $$;

-- ── 2. Carrier SELECT policy ───────────────────────────────────────────────
-- Carriers can read invitations addressed to them by company_id or email.
-- auth.email() returns the authenticated user's email from the JWT (Supabase built-in).
-- The email column may be named carrier_email (original schema) or invited_email
-- (renamed by a later migration).  We detect which name exists and build the
-- policy expression dynamically so this migration is safe in either scenario.
DROP POLICY IF EXISTS "broker_carrier_inv_carrier_select" ON public.broker_carrier_invitations;

DO $$
DECLARE
  email_col text;
BEGIN
  SELECT column_name INTO email_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'broker_carrier_invitations'
    AND column_name  IN ('carrier_email', 'invited_email')
  ORDER BY column_name  -- carrier_email first for determinism on fresh DB
  LIMIT 1;

  IF email_col IS NOT NULL THEN
    EXECUTE format(
      $policy$
        CREATE POLICY "broker_carrier_inv_carrier_select"
        ON public.broker_carrier_invitations
        FOR SELECT
        TO authenticated
        USING (
          carrier_company_id = public.auth_company_id()
          OR (
            %1$I IS NOT NULL
            AND auth.email() IS NOT NULL
            AND lower(%1$I) = lower(auth.email())
          )
        )
      $policy$,
      email_col
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
