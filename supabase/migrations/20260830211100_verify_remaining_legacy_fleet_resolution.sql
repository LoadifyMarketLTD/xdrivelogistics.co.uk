BEGIN;

-- P0-12 durable postconditions. Verification is read-only: no company,
-- membership, onboarding, approval, document, finance, or operational mutation.
DO $$
DECLARE
  v_creator_def text;
  v_registration_def text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.account_type = 'fleet_courier'
      AND oa.company_id IS NULL
      AND oa.payload->>'legacy_persisted_account_type' = 'fleet_operator'
      AND NOT EXISTS (
        SELECT 1
        FROM public.legacy_fleet_onboarding_resolutions r
        WHERE r.application_id = oa.id
          AND r.user_id = oa.user_id
      )
  ) THEN
    RAISE EXCEPTION 'A remaining legacy Fleet application has no explicit P0-12 resolution.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legacy_fleet_onboarding_resolutions r
    JOIN public.onboarding_applications oa ON oa.id = r.application_id
    WHERE oa.user_id <> r.user_id
       OR oa.account_type <> 'fleet_courier'
       OR oa.company_id IS NOT NULL
       OR oa.payload->>'legacy_persisted_account_type' <> 'fleet_operator'
       OR oa.payload->>'legacy_fleet_resolution' IS DISTINCT FROM r.resolution_code
       OR oa.payload->>'legacy_fleet_resolution_classification' IS DISTINCT FROM r.classification
  ) THEN
    RAISE EXCEPTION 'A P0-12 resolution does not match its canonical unbound Fleet onboarding record.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legacy_fleet_onboarding_resolutions r
    WHERE r.classification = 'REMOVE'
  ) THEN
    RAISE EXCEPTION 'P0-12 must not delete/remove historical Fleet identities or companies.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legacy_fleet_onboarding_resolutions r
    LEFT JOIN public.companies c ON c.id = r.legacy_company_id
    LEFT JOIN public.profiles p ON p.user_id = r.user_id
    WHERE r.classification = 'MIGRATE'
      AND r.resolution_code = 'quarantine_legacy_active_shell'
      AND (
        r.legacy_company_id IS NULL
        OR c.id IS NULL
        OR c.created_by <> r.user_id
        OR c.status::text <> 'suspended'
        OR p.company_id IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = c.id
            AND cm.user_id = r.user_id
            AND cm.status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM public.company_registration_claims claim
          WHERE claim.company_id = c.id
        )
      )
  ) THEN
    RAISE EXCEPTION 'A quarantined legacy Fleet company shell still carries company authority.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legacy_fleet_onboarding_resolutions r
    WHERE r.classification = 'KEEP'
      AND (
        r.resolution_code <> 'keep_unbound_no_company'
        OR r.legacy_company_id IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM public.companies c WHERE c.created_by = r.user_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'A KEEP legacy Fleet application unexpectedly has company provenance.';
  END IF;

  SELECT pg_get_functiondef('public.is_company_creator(uuid)'::regprocedure)
  INTO v_creator_def;

  IF v_creator_def NOT ILIKE '%pending_approval%'
     OR v_creator_def NOT ILIKE '%c.created_by = auth.uid()%'
  THEN
    RAISE EXCEPTION 'Creator membership bootstrap is not restricted to pending-approval companies.';
  END IF;

  IF has_function_privilege('anon', 'public.is_company_creator(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role can execute the creator bootstrap predicate.';
  END IF;

  SELECT pg_get_functiondef(
    'public.register_validated_company_atomic(uuid,text,text,text,text)'::regprocedure
  ) INTO v_registration_def;

  IF v_registration_def NOT ILIKE '%legacy_fleet_onboarding_resolutions%'
     OR v_registration_def NOT ILIKE '%quarantine_legacy_active_shell%'
     OR v_registration_def NOT ILIKE '%v_company.status::text = ''pending_approval''%'
  THEN
    RAISE EXCEPTION 'Verified company registration does not exclude quarantined Fleet shells or still trusts active created_by authority.';
  END IF;

  IF has_function_privilege('anon', 'public.register_validated_company_atomic(uuid,text,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.register_validated_company_atomic(uuid,text,text,text,text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Client roles can execute the service-controlled verified company registration RPC.';
  END IF;
END;
$$;

COMMIT;
