-- Remove claims inferred only from legacy local data and enforce the verified
-- company binding for every protected broker/fleet onboarding update.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Migration 20260723205000 initially creates claims for unambiguous legacy rows
-- so existing companies remain recoverable. Such rows have no provider-backed
-- audit event and must not count as Companies House verification. A registration
-- request that passed the server-side registry check always writes created/reused
-- audit evidence in the same transaction, so those claims are preserved.
DELETE FROM public.company_registration_claims claim
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_registration_audit audit
  WHERE audit.company_id = claim.company_id
    AND audit.company_number = claim.company_number
    AND audit.actor_user_id = claim.claimed_by
    AND audit.action IN ('created', 'reused')
    AND audit.metadata->>'source' = 'companies_house_server_validation'
    AND lower(coalesce(audit.metadata->>'registry_status', '')) = 'active'
);

CREATE OR REPLACE FUNCTION public.enforce_verified_company_onboarding_submission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_number text;
BEGIN
  IF NEW.account_type IN ('broker_shipper', 'fleet_courier')
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
        AND EXISTS (
          SELECT 1
          FROM public.company_registration_audit audit
          WHERE audit.company_id = claim.company_id
            AND audit.company_number = claim.company_number
            AND audit.actor_user_id = claim.claimed_by
            AND audit.action IN ('created', 'reused')
            AND audit.metadata->>'source' = 'companies_house_server_validation'
            AND lower(coalesce(audit.metadata->>'registry_status', '')) = 'active'
        )
    ) THEN
      RAISE EXCEPTION 'Broker/fleet onboarding requires a verified Companies House registration claim.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_verified_company_onboarding_submission()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_verified_company_onboarding_submission()
  TO service_role;

COMMENT ON FUNCTION public.enforce_verified_company_onboarding_submission()
IS 'Requires provider-backed Companies House audit evidence whenever broker/fleet onboarding is submitted, reviewed or approved.';

NOTIFY pgrst, 'reload schema';

COMMIT;
