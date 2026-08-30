BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- P0-12: resolve the five historical Fleet applications intentionally left
-- unbound by P0-11. Never infer a company from names/emails. A legacy company is
-- quarantined only when the actor created exactly one ACTIVE shell and the shell
-- has no current authority, compliance, operational, finance, registration, or
-- workspace dependencies. Historical audit evidence is retained.

CREATE TABLE IF NOT EXISTS public.legacy_fleet_onboarding_resolutions (
  application_id uuid PRIMARY KEY REFERENCES public.onboarding_applications(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  legacy_company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  classification text NOT NULL CHECK (classification IN ('KEEP', 'REPAIR', 'MIGRATE', 'REMOVE')),
  resolution_code text NOT NULL,
  reason text NOT NULL,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.legacy_fleet_onboarding_resolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.legacy_fleet_onboarding_resolutions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.legacy_fleet_onboarding_resolutions TO service_role;

CREATE TEMP TABLE p0_12_legacy_fleet_plan (
  application_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  legacy_company_id uuid,
  classification text NOT NULL,
  resolution_code text NOT NULL,
  reason text NOT NULL,
  evidence_snapshot jsonb NOT NULL
) ON COMMIT DROP;

-- Three historical Fleet applicants never created a company. They are valid
-- incomplete onboarding requests and remain unbound so the canonical verified
-- company-registration flow can be used later.
INSERT INTO p0_12_legacy_fleet_plan (
  application_id, user_id, legacy_company_id,
  classification, resolution_code, reason, evidence_snapshot
)
SELECT
  oa.id,
  oa.user_id,
  NULL::uuid,
  'KEEP',
  'keep_unbound_no_company',
  'Historical Fleet onboarding has no company provenance. Keep the incomplete application unbound and require canonical verified company registration before submission.',
  jsonb_build_object(
    'onboarding_status', oa.status,
    'current_step', oa.current_step,
    'completion_percentage', oa.completion_percentage,
    'onboarding_created_at', oa.created_at,
    'created_company_count', 0,
    'membership_count', (SELECT count(*) FROM public.company_memberships cm WHERE cm.user_id = oa.user_id),
    'profile_company_id', p.company_id
  )
FROM public.onboarding_applications oa
LEFT JOIN public.profiles p ON p.user_id = oa.user_id
WHERE oa.account_type = 'fleet_courier'
  AND oa.company_id IS NULL
  AND oa.payload->>'legacy_persisted_account_type' = 'fleet_operator'
  AND NOT EXISTS (
    SELECT 1 FROM public.companies c WHERE c.created_by = oa.user_id
  );

-- A legacy ACTIVE company may be treated as a migration shell only when every
-- relevant current dependency is absent. Audit rows are deliberately allowed and
-- preserved; they are evidence, not operational authority.
INSERT INTO p0_12_legacy_fleet_plan (
  application_id, user_id, legacy_company_id,
  classification, resolution_code, reason, evidence_snapshot
)
SELECT
  oa.id,
  oa.user_id,
  c.id,
  'MIGRATE',
  'quarantine_legacy_active_shell',
  'Legacy pre-governance company shell has creator provenance but no current authority, compliance, operational, finance, registration, or workspace dependencies. Preserve it as inactive history and require canonical verified company registration.',
  jsonb_build_object(
    'onboarding_status', oa.status,
    'current_step', oa.current_step,
    'completion_percentage', oa.completion_percentage,
    'onboarding_created_at', oa.created_at,
    'company_status_before', c.status::text,
    'company_type_before', c.company_type,
    'company_created_at', c.created_at,
    'company_number_present', nullif(trim(coalesce(c.company_number, '')), '') IS NOT NULL,
    'current_profile_company_id', p.company_id,
    'current_membership_count', (SELECT count(*) FROM public.company_memberships cm WHERE cm.user_id = oa.user_id),
    'historical_profile_was_bound', COALESCE((
      SELECT (s.profile_row->>'company_id')::uuid = c.id
      FROM public.account_reconciliation_confirmed_20260721_snapshot s
      WHERE s.user_id = oa.user_id
      LIMIT 1
    ), false),
    'historical_membership_snapshot', COALESCE((
      SELECT s.membership_rows
      FROM public.account_reconciliation_confirmed_20260721_snapshot s
      WHERE s.user_id = oa.user_id
      LIMIT 1
    ), '[]'::jsonb),
    'owner_audit_rows', (SELECT count(*) FROM public.owner_audit_log oal WHERE oal.target_company_id = c.id OR oal.target_id = c.id)
  )
FROM public.onboarding_applications oa
JOIN public.profiles p ON p.user_id = oa.user_id AND p.company_id IS NULL
JOIN public.companies c ON c.created_by = oa.user_id AND c.status::text = 'active'
WHERE oa.account_type = 'fleet_courier'
  AND oa.company_id IS NULL
  AND oa.payload->>'legacy_persisted_account_type' = 'fleet_operator'
  AND (SELECT count(*) FROM public.companies c2 WHERE c2.created_by = oa.user_id) = 1
  AND NOT EXISTS (SELECT 1 FROM public.company_memberships x WHERE x.company_id = c.id OR x.user_id = oa.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.company_members x WHERE x.company_id = c.id OR x.user_id = oa.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.profiles x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.onboarding_applications x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.company_business_types x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.company_settings x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.company_documents x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.documents x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.document_fingerprints x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.vehicles x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.drivers x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.driver_locations x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.driver_availability_presence x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.driver_load_alert_preferences x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.return_journeys x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.quotes x WHERE x.company_id = c.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.jobs x
    WHERE x.company_id = c.id
       OR x.posted_by_company_id = c.id
       OR x.assigned_company_id = c.id
       OR x.awarded_carrier_company_id = c.id
       OR x.direct_invite_company_id = c.id
  )
  AND NOT EXISTS (SELECT 1 FROM public.job_bids x WHERE x.company_id = c.id OR x.bidder_company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.job_documents x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.job_commercial_agreements x WHERE x.buyer_company_id = c.id OR x.supplier_company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.job_disputes x WHERE x.raised_by_company_id = c.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.job_cancellation_requests x
    WHERE x.carrier_company_id = c.id OR x.owner_company_id = c.id OR x.requester_company_id = c.id
  )
  AND NOT EXISTS (SELECT 1 FROM public.invoices x WHERE x.company_id = c.id OR x.buyer_company_id = c.id OR x.supplier_company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoice_disputes x WHERE x.company_id = c.id OR x.buyer_company_id = c.id OR x.supplier_company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoice_documents x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoice_payment_history x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoice_status_history x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.messages x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.notifications x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.notification_events x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.invites x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.reviews x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.support_tickets x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.broker_carrier_invitations x WHERE x.broker_company_id = c.id OR x.carrier_company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.fraud_review_cases x WHERE x.subject_company_id = c.id OR x.matched_company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.platform_identity_registry x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.telematics_driver_bindings x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.company_registration_claims x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.company_registration_audit x WHERE x.company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.workspace_switch_audit x WHERE x.target_company_id = c.id);

-- Fail closed if any remaining historical Fleet application cannot be classified
-- by provenance. A clean database has no such historical rows and passes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.account_type = 'fleet_courier'
      AND oa.company_id IS NULL
      AND oa.payload->>'legacy_persisted_account_type' = 'fleet_operator'
      AND NOT EXISTS (
        SELECT 1 FROM p0_12_legacy_fleet_plan plan WHERE plan.application_id = oa.id
      )
  ) THEN
    RAISE EXCEPTION 'P0-12 found a legacy Fleet application without sufficient provenance for KEEP/MIGRATE classification.';
  END IF;
END;
$$;

INSERT INTO public.legacy_fleet_onboarding_resolutions (
  application_id, user_id, legacy_company_id,
  classification, resolution_code, reason, evidence_snapshot
)
SELECT
  plan.application_id,
  plan.user_id,
  plan.legacy_company_id,
  plan.classification,
  plan.resolution_code,
  plan.reason,
  plan.evidence_snapshot
FROM p0_12_legacy_fleet_plan plan
ON CONFLICT (application_id) DO NOTHING;

-- Preserve legacy company rows and audit evidence, but remove their operational
-- authority. No company is deleted and no onboarding is approved or submitted.
UPDATE public.companies c
SET status = 'inactive',
    updated_at = now()
FROM p0_12_legacy_fleet_plan plan
WHERE plan.classification = 'MIGRATE'
  AND plan.legacy_company_id = c.id
  AND c.status::text = 'active';

UPDATE public.onboarding_applications oa
SET payload = COALESCE(oa.payload, '{}'::jsonb) || jsonb_build_object(
      'legacy_fleet_resolution', plan.resolution_code,
      'legacy_fleet_resolution_classification', plan.classification,
      'legacy_fleet_resolved_at', now()
    ),
    updated_at = now()
FROM p0_12_legacy_fleet_plan plan
WHERE plan.application_id = oa.id;

-- Creator bootstrap exists only to attach the initial owner membership to a
-- newly-created pending company. created_by must never let a user reclaim owner
-- authority on an already-active company after its membership has disappeared.
CREATE OR REPLACE FUNCTION public.is_company_creator(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = cid
      AND c.created_by = auth.uid()
      AND c.status::text = 'pending_approval'
  );
$$;

REVOKE ALL ON FUNCTION public.is_company_creator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_creator(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_company_creator(uuid) IS
  'Bootstrap-only creator predicate. True only for the authenticated creator of a pending-approval company; active company authority requires canonical membership.';

-- Rebuild the canonical verified-company registration RPC so an explicitly
-- quarantined historical shell does not block a fresh Companies House verified
-- registration. Non-quarantined legacy companies remain conservative blockers.
CREATE OR REPLACE FUNCTION public.register_validated_company_atomic(
  p_actor_user_id uuid,
  p_company_number text,
  p_company_name text,
  p_registry_status text,
  p_account_type text
)
RETURNS TABLE (
  success boolean,
  http_status integer,
  error_code text,
  error_message text,
  company_id uuid,
  created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_company_number text := regexp_replace(upper(trim(coalesce(p_company_number, ''))), '[^A-Z0-9]', '', 'g');
  v_company_name text := trim(coalesce(p_company_name, ''));
  v_registry_status text := lower(trim(coalesce(p_registry_status, '')));
  v_account_type text := lower(trim(coalesce(p_account_type, '')));
  v_company_type text;
  v_company public.companies%ROWTYPE;
  v_match_count integer := 0;
  v_other_company_count integer := 0;
  v_authorized boolean := false;
  v_created boolean := false;
BEGIN
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_actor_user_id
  ) THEN
    RETURN QUERY SELECT false, 401, 'INVALID_ACTOR', 'Authenticated actor is required.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_company_number !~ '^[A-Z0-9]{6,16}$' THEN
    RETURN QUERY SELECT false, 400, 'INVALID_COMPANY_NUMBER', 'Company number is invalid.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_company_name = '' OR length(v_company_name) > 500 THEN
    RETURN QUERY SELECT false, 400, 'INVALID_COMPANY_NAME', 'Company name is invalid.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_registry_status <> 'active' THEN
    RETURN QUERY SELECT false, 409, 'REGISTRY_STATUS_NOT_ACTIVE', 'Only active Companies House records may register.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_account_type = 'broker_shipper' THEN
    v_company_type := 'broker';
  ELSIF v_account_type = 'fleet_courier' THEN
    v_company_type := 'carrier';
  ELSE
    RETURN QUERY SELECT false, 400, 'INVALID_ACCOUNT_TYPE', 'Company registration is limited to broker and fleet accounts.', NULL::uuid, false;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('register-company-user:' || p_actor_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('register-company-number:' || v_company_number, 0));

  SELECT c.*
  INTO v_company
  FROM public.company_registration_claims claim
  JOIN public.companies c ON c.id = claim.company_id
  WHERE claim.company_number = v_company_number
    AND NOT EXISTS (
      SELECT 1
      FROM public.legacy_fleet_onboarding_resolutions r
      WHERE r.legacy_company_id = c.id
        AND r.classification = 'MIGRATE'
        AND r.resolution_code = 'quarantine_legacy_active_shell'
    )
  FOR UPDATE OF claim, c;

  IF NOT FOUND THEN
    SELECT count(*)
    INTO v_match_count
    FROM public.companies c
    WHERE regexp_replace(upper(trim(coalesce(c.company_number, ''))), '[^A-Z0-9]', '', 'g') = v_company_number
      AND NOT EXISTS (
        SELECT 1
        FROM public.legacy_fleet_onboarding_resolutions r
        WHERE r.legacy_company_id = c.id
          AND r.classification = 'MIGRATE'
          AND r.resolution_code = 'quarantine_legacy_active_shell'
      );

    IF v_match_count > 1 THEN
      RETURN QUERY SELECT false, 409, 'DUPLICATE_LEGACY_COMPANIES',
        'Multiple existing companies use this company number. An administrator must resolve them.', NULL::uuid, false;
      RETURN;
    END IF;

    IF v_match_count = 1 THEN
      SELECT c.*
      INTO v_company
      FROM public.companies c
      WHERE regexp_replace(upper(trim(coalesce(c.company_number, ''))), '[^A-Z0-9]', '', 'g') = v_company_number
        AND NOT EXISTS (
          SELECT 1
          FROM public.legacy_fleet_onboarding_resolutions r
          WHERE r.legacy_company_id = c.id
            AND r.classification = 'MIGRATE'
            AND r.resolution_code = 'quarantine_legacy_active_shell'
        )
      FOR UPDATE;
    END IF;
  END IF;

  IF v_company.id IS NOT NULL THEN
    SELECT (
      (v_company.status::text = 'pending_approval' AND v_company.created_by = p_actor_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.company_memberships cm
        WHERE cm.company_id = v_company.id
          AND cm.user_id = p_actor_user_id
          AND cm.status = 'active'
          AND cm.role_in_company = 'owner'
      )
    )
    INTO v_authorized;

    IF NOT v_authorized THEN
      RETURN QUERY SELECT false, 409, 'COMPANY_ALREADY_REGISTERED',
        'This company number is already registered to another account.', NULL::uuid, false;
      RETURN;
    END IF;

    SELECT count(DISTINCT c.id)
    INTO v_other_company_count
    FROM public.companies c
    WHERE c.id <> v_company.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.legacy_fleet_onboarding_resolutions r
        WHERE r.legacy_company_id = c.id
          AND r.classification = 'MIGRATE'
          AND r.resolution_code = 'quarantine_legacy_active_shell'
      )
      AND (
        c.created_by = p_actor_user_id
        OR EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = c.id
            AND cm.user_id = p_actor_user_id
            AND cm.status = 'active'
            AND cm.role_in_company = 'owner'
        )
      );

    IF v_other_company_count > 0 THEN
      RETURN QUERY SELECT false, 409, 'ACCOUNT_HAS_MULTIPLE_COMPANIES',
        'This account is linked to another company. An administrator must confirm the correct company.', NULL::uuid, false;
      RETURN;
    END IF;

    v_created := false;
  ELSE
    SELECT count(DISTINCT c.id)
    INTO v_other_company_count
    FROM public.companies c
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.legacy_fleet_onboarding_resolutions r
        WHERE r.legacy_company_id = c.id
          AND r.classification = 'MIGRATE'
          AND r.resolution_code = 'quarantine_legacy_active_shell'
      )
      AND (
        c.created_by = p_actor_user_id
        OR EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = c.id
            AND cm.user_id = p_actor_user_id
            AND cm.status = 'active'
            AND cm.role_in_company = 'owner'
        )
      );

    IF v_other_company_count > 0 THEN
      RETURN QUERY SELECT false, 409, 'ACCOUNT_ALREADY_LINKED_TO_COMPANY',
        'This account is already linked to another company.', NULL::uuid, false;
      RETURN;
    END IF;

    INSERT INTO public.companies (
      name,
      company_number,
      status,
      company_type,
      created_by
    )
    VALUES (
      v_company_name,
      v_company_number,
      'pending_approval',
      v_company_type,
      p_actor_user_id
    )
    RETURNING * INTO v_company;

    v_created := true;
  END IF;

  UPDATE public.companies
  SET name = v_company_name,
      company_number = v_company_number,
      company_type = v_company_type
  WHERE id = v_company.id;

  INSERT INTO public.company_registration_claims (
    company_number,
    company_id,
    claimed_by,
    registry_name,
    registry_status,
    updated_at
  )
  VALUES (
    v_company_number,
    v_company.id,
    p_actor_user_id,
    v_company_name,
    v_registry_status,
    now()
  )
  ON CONFLICT (company_number)
  DO UPDATE SET
    registry_name = EXCLUDED.registry_name,
    registry_status = EXCLUDED.registry_status,
    updated_at = now()
  WHERE public.company_registration_claims.company_id = EXCLUDED.company_id
    AND public.company_registration_claims.claimed_by = EXCLUDED.claimed_by;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_registration_claims claim
    WHERE claim.company_number = v_company_number
      AND claim.company_id = v_company.id
      AND claim.claimed_by = p_actor_user_id
  ) THEN
    RETURN QUERY SELECT false, 409, 'COMPANY_CLAIM_CONFLICT',
      'The company number was claimed by another registration.', NULL::uuid, false;
    RETURN;
  END IF;

  INSERT INTO public.company_memberships (
    company_id,
    user_id,
    role_in_company,
    status,
    updated_at
  )
  VALUES (
    v_company.id,
    p_actor_user_id,
    'owner',
    'active',
    now()
  )
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET
    role_in_company = 'owner',
    status = 'active',
    updated_at = now();

  UPDATE public.profiles
  SET company_id = COALESCE(company_id, v_company.id),
      updated_at = now()
  WHERE user_id = p_actor_user_id;

  INSERT INTO public.company_registration_audit (
    actor_user_id,
    company_id,
    company_number,
    action,
    metadata
  )
  VALUES (
    p_actor_user_id,
    v_company.id,
    v_company_number,
    CASE WHEN v_created THEN 'created' ELSE 'reused' END,
    jsonb_build_object(
      'registered_name', v_company_name,
      'registry_status', v_registry_status,
      'account_type', v_account_type,
      'source', 'companies_house_server_validation'
    )
  );

  RETURN QUERY SELECT true, CASE WHEN v_created THEN 201 ELSE 200 END,
    NULL::text, NULL::text, v_company.id, v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text, text) IS
  'Server-authenticated Companies House verified broker/fleet registration. Explicitly quarantined legacy Fleet shells are historical evidence only and never company authority.';

NOTIFY pgrst, 'reload schema';
COMMIT;
