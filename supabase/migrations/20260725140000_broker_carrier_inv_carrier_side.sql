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
DROP POLICY IF EXISTS "broker_carrier_inv_carrier_select" ON public.broker_carrier_invitations;

CREATE POLICY "broker_carrier_inv_carrier_select"
ON public.broker_carrier_invitations
FOR SELECT
TO authenticated
USING (
  carrier_company_id = public.auth_company_id()
  OR (
    carrier_email IS NOT NULL
    AND auth.email() IS NOT NULL
    AND lower(carrier_email) = lower(auth.email())
  )
);

NOTIFY pgrst, 'reload schema';

COMMIT;
