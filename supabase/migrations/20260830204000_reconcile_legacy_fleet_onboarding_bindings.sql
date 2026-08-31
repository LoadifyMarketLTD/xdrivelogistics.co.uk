BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Hosted production carries companies.updated_at as TIMESTAMPTZ NOT NULL
-- DEFAULT now(). Fresh replay must reconstruct that physical contract before
-- the legacy Fleet company-type reconciliation first writes the audit field.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  v_data_type text;
  v_nullable text;
  v_default text;
BEGIN
  SELECT c.data_type, c.is_nullable, c.column_default
  INTO v_data_type, v_nullable, v_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'companies'
    AND c.column_name = 'updated_at';

  IF v_data_type IS DISTINCT FROM 'timestamp with time zone'
     OR v_nullable IS DISTINCT FROM 'NO'
     OR v_default IS NULL
     OR lower(v_default) NOT LIKE '%now()%'
  THEN
    RAISE EXCEPTION
      'companies.updated_at clean-replay contract is not TIMESTAMPTZ NOT NULL DEFAULT now().';
  END IF;
END;
$$;

-- P0-11: converge the historical persisted `fleet_operator` onboarding alias to
-- the canonical `fleet_courier` contract. Preserve applicant status/progress and
-- never infer a company relationship unless production data proves a unique,
-- internally consistent company/profile/membership binding.
UPDATE public.onboarding_applications oa
SET account_type = 'fleet_courier',
    payload = jsonb_set(
      jsonb_set(
        COALESCE(oa.payload, '{}'::jsonb),
        '{canonical_account_type}',
        '"fleet_courier"'::jsonb,
        true
      ),
      '{legacy_persisted_account_type}',
      '"fleet_operator"'::jsonb,
      true
    )
WHERE oa.account_type = 'fleet_operator';

-- Bind only the strong legacy cohort:
--   * application was persisted as fleet_operator;
--   * creator has exactly one company and it is still pending approval;
--   * authoritative profile already points at that company;
--   * exactly one company membership exists and it is owner/invited there;
--   * signup metadata independently agrees that this was Fleet Operator.
WITH candidates AS (
  SELECT oa.id AS application_id, c.id AS company_id
  FROM public.onboarding_applications oa
  JOIN auth.users u ON u.id = oa.user_id
  JOIN public.profiles p ON p.user_id = oa.user_id
  JOIN public.companies c
    ON c.created_by = oa.user_id
   AND c.status::text = 'pending_approval'
  JOIN public.company_memberships cm
    ON cm.user_id = oa.user_id
   AND cm.company_id = c.id
   AND cm.role_in_company = 'owner'
   AND cm.status::text = 'invited'
  WHERE oa.account_type = 'fleet_courier'
    AND oa.company_id IS NULL
    AND oa.payload->>'legacy_persisted_account_type' = 'fleet_operator'
    AND p.company_id = c.id
    AND lower(COALESCE(u.raw_user_meta_data->>'requested_role', '')) = 'fleet_operator'
    AND lower(COALESCE(u.raw_user_meta_data->>'signup_type', '')) = 'fleet_operator'
    AND lower(COALESCE(u.raw_user_meta_data->>'account_type', '')) = 'fleet_operator'
    AND (SELECT count(*) FROM public.companies c2 WHERE c2.created_by = oa.user_id) = 1
    AND (SELECT count(*) FROM public.company_memberships cm2 WHERE cm2.user_id = oa.user_id) = 1
)
UPDATE public.onboarding_applications oa
SET company_id = candidate.company_id,
    payload = jsonb_set(
      COALESCE(oa.payload, '{}'::jsonb),
      '{legacy_company_binding_reconciled}',
      'true'::jsonb,
      true
    )
FROM candidates candidate
WHERE oa.id = candidate.application_id;

-- A provably bound Fleet/Courier company must carry the canonical carrier type.
-- Do not change active legacy companies or ambiguous records in this repair.
UPDATE public.companies c
SET company_type = 'carrier',
    updated_at = now()
FROM public.onboarding_applications oa
WHERE oa.company_id = c.id
  AND oa.account_type = 'fleet_courier'
  AND oa.payload->>'legacy_company_binding_reconciled' = 'true'
  AND c.status::text = 'pending_approval'
  AND COALESCE(c.company_type, 'standard') = 'standard';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.account_type = 'fleet_operator'
  ) THEN
    RAISE EXCEPTION 'Legacy fleet_operator onboarding rows remain after canonicalization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.payload->>'legacy_persisted_account_type' = 'fleet_operator'
      AND oa.account_type <> 'fleet_courier'
  ) THEN
    RAISE EXCEPTION 'A normalized legacy Fleet application does not use fleet_courier.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    LEFT JOIN public.companies c ON c.id = oa.company_id
    LEFT JOIN public.profiles p ON p.user_id = oa.user_id
    WHERE oa.payload->>'legacy_company_binding_reconciled' = 'true'
      AND (
        oa.company_id IS NULL
        OR c.id IS NULL
        OR c.status::text <> 'pending_approval'
        OR c.company_type <> 'carrier'
        OR p.company_id IS DISTINCT FROM c.id
        OR NOT EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.user_id = oa.user_id
            AND cm.company_id = c.id
            AND cm.role_in_company = 'owner'
            AND cm.status::text = 'invited'
        )
      )
  ) THEN
    RAISE EXCEPTION 'A reconciled legacy Fleet company binding failed its safety invariants.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
