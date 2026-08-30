BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- P0-12: resolve the historical Fleet applications intentionally left unbound by
-- P0-11. Never infer a company from names/emails. A legacy company is quarantined
-- only when the actor created exactly one ACTIVE shell and the shell has no
-- current authority, compliance, operational, finance, registration, or workspace
-- dependencies. Historical audit evidence is retained.

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

-- KEEP: no company provenance exists. These incomplete Fleet applications stay
-- unbound and must use the canonical verified registration flow later.
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

-- MIGRATE: a pre-governance ACTIVE shell exists, but only a dependency-free shell
-- can be quarantined. Audit rows are evidence and are deliberately preserved.
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
  'Legacy pre-governance company shell has creator provenance but no current authority, compliance, operational, finance, registration, or workspace dependencies. Preserve it in canonical suspended quarantine and require canonical verified company registration.',
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
    'owner_audit_rows_before', (
      SELECT count(*)
      FROM public.owner_audit_log oal
      WHERE oal.target_company_id = c.id OR oal.target_id = c.id
    )
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
-- from provenance. Clean databases have no historical rows and therefore pass.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.account_type = 'fleet_courier'
      AND oa.company_id IS NULL
      AND oa.payload->>'legacy_persisted_account_type' = 'fleet_operator'
      AND NOT EXISTS (
        SELECT 1
        FROM p0_12_legacy_fleet_plan plan
        WHERE plan.application_id = oa.id
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

-- Quarantine through the canonical service-role governance RPC. Do not bypass
-- the company status transition/audit guards. A unique active internal platform
-- owner is required only when production actually has MIGRATE rows.
DO $$
DECLARE
  v_actor_user_id uuid;
  v_actor_count integer;
  v_plan record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM p0_12_legacy_fleet_plan WHERE classification = 'MIGRATE'
  ) THEN
    SELECT count(*)
    INTO v_actor_count
    FROM public.profiles p
    WHERE p.role = 'owner'
      AND p.status::text = 'active'
      AND COALESCE(p.is_internal_account, false) = true;

    IF v_actor_count <> 1 THEN
      RAISE EXCEPTION 'P0-12 requires exactly one active internal platform owner for governance audit; found %.', v_actor_count;
    END IF;

    SELECT p.user_id
    INTO v_actor_user_id
    FROM public.profiles p
    WHERE p.role = 'owner'
      AND p.status::text = 'active'
      AND COALESCE(p.is_internal_account, false) = true
    LIMIT 1;

    FOR v_plan IN
      SELECT legacy_company_id
      FROM p0_12_legacy_fleet_plan
      WHERE classification = 'MIGRATE'
      ORDER BY legacy_company_id
    LOOP
      PERFORM public.set_company_status_governance(
        v_actor_user_id,
        v_plan.legacy_company_id,
        'status_change',
        'suspended',
        'P0-12 legacy Fleet shell quarantine after provenance and zero-dependency verification.'
      );
    END LOOP;
  END IF;
END;
$$;

UPDATE public.onboarding_applications oa
SET payload = COALESCE(oa.payload, '{}'::jsonb) || jsonb_build_object(
      'legacy_fleet_resolution', plan.resolution_code,
      'legacy_fleet_resolution_classification', plan.classification,
      'legacy_fleet_resolved_at', now()
    ),
    updated_at = now()
FROM p0_12_legacy_fleet_plan plan
WHERE plan.application_id = oa.id;

-- Creator bootstrap is only for a newly-created pending company. created_by must
-- not allow a user to reclaim owner authority on an already-active company after
-- its membership disappears.
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

NOTIFY pgrst, 'reload schema';
COMMIT;
