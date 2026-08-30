BEGIN;

-- P0-02 prerequisite: restore the canonical onboarding state machine defined by
-- migration 102. Production drifted back to a constraint that omitted `invited`,
-- while ensure_company_driver_onboarding() still creates invitation records with
-- status `invited`. Keep the state machine canonical and fail closed.

ALTER TABLE public.onboarding_applications
  DROP CONSTRAINT IF EXISTS onboarding_applications_status_check;

ALTER TABLE public.onboarding_applications
  ADD CONSTRAINT onboarding_applications_status_check
  CHECK (status IN (
    'invited',
    'draft',
    'in_progress',
    'under_review',
    'request_changes',
    'approved',
    'rejected'
  ));

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.onboarding_applications'::regclass
    AND conname = 'onboarding_applications_status_check';

  IF v_constraint IS NULL OR position('invited' in v_constraint) = 0 THEN
    RAISE EXCEPTION 'Canonical onboarding invited status was not restored.';
  END IF;
END;
$$;

COMMIT;
