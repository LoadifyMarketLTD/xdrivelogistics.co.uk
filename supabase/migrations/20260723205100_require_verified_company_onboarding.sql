-- Bind broker/fleet onboarding submission to the canonical Companies House claim.
-- Applicant clients may no longer call the submission RPC directly.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- The canonical onboarding submission function resolves companies by created_by.
-- Keep the new claim owner aligned to that canonical creator so legacy owner
-- memberships cannot silently redirect onboarding to the wrong company.
DELETE FROM public.company_registration_claims claim
USING public.companies company
WHERE company.id = claim.company_id
  AND company.created_by IS NULL;

UPDATE public.company_registration_claims claim
SET claimed_by = company.created_by,
    updated_at = now()
FROM public.companies company
WHERE company.id = claim.company_id
  AND company.created_by IS NOT NULL
  AND claim.claimed_by IS DISTINCT FROM company.created_by;

CREATE OR REPLACE FUNCTION public.enforce_company_registration_claim_creator()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator uuid;
BEGIN
  SELECT company.created_by
  INTO v_creator
  FROM public.companies company
  WHERE company.id = NEW.company_id;

  IF v_creator IS NULL OR NEW.claimed_by IS DISTINCT FROM v_creator THEN
    RAISE EXCEPTION 'Company registration claim must belong to the canonical company creator.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS company_registration_claim_creator_guard
  ON public.company_registration_claims;
CREATE TRIGGER company_registration_claim_creator_guard
BEFORE INSERT OR UPDATE OF company_id, claimed_by
ON public.company_registration_claims
FOR EACH ROW
EXECUTE FUNCTION public.enforce_company_registration_claim_creator();

CREATE OR REPLACE FUNCTION public.enforce_verified_company_onboarding_submission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_number text;
BEGIN
  IF NEW.account_type IN ('broker_shipper', 'fleet_courier')
     AND OLD.status IN ('draft', 'in_progress', 'request_changes')
     AND NEW.status IN ('submitted', 'under_review', 'approved') THEN
    v_company_number := regexp_replace(
      upper(trim(coalesce(NEW.payload->>'company_number', ''))),
      '[^A-Z0-9]',
      '',
      'g'
    );

    IF NEW.company_id IS NULL OR v_company_number = '' OR NOT EXISTS (
      SELECT 1
      FROM public.company_registration_claims claim
      WHERE claim.company_number = v_company_number
        AND claim.company_id = NEW.company_id
        AND claim.claimed_by = NEW.user_id
        AND claim.registry_status = 'active'
    ) THEN
      RAISE EXCEPTION 'Broker/fleet onboarding requires a verified Companies House registration claim.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_verified_company_submission_guard
  ON public.onboarding_applications;
CREATE TRIGGER onboarding_verified_company_submission_guard
BEFORE UPDATE OF status, company_id, payload
ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_verified_company_onboarding_submission();

-- All onboarding submit routes already authenticate the bearer token and invoke
-- this RPC through the server-side service-role client. Removing authenticated
-- execution closes the direct client bypass around Companies House validation.
REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid)
  TO service_role;

COMMENT ON FUNCTION public.enforce_verified_company_onboarding_submission()
IS 'Prevents broker/fleet onboarding submission unless the application is bound to the actor-owned active Companies House claim.';

NOTIFY pgrst, 'reload schema';

COMMIT;
