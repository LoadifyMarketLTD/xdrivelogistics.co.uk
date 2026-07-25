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
  v_conname text;
BEGIN
  -- Find the inline status check (may be system-named)
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.broker_carrier_invitations'::regclass
    AND pg_get_constraintdef(oid) LIKE '%pending%accepted%revoked%'
    AND contype = 'c'
  ORDER BY oid
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.broker_carrier_invitations DROP CONSTRAINT %I',
      v_conname
    );
  END IF;

  -- Re-add with 'rejected' included
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
    AND lower(carrier_email) = lower(auth.email())
  )
);

NOTIFY pgrst, 'reload schema';

COMMIT;
