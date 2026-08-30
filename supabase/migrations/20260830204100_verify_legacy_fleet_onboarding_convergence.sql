BEGIN;

-- P0-11 durable postconditions. This verification performs no account approval,
-- membership activation, document approval or progress/status mutation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.account_type = 'fleet_operator'
  ) THEN
    RAISE EXCEPTION 'Legacy fleet_operator onboarding rows still exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.payload->>'legacy_persisted_account_type' = 'fleet_operator'
      AND (
        oa.account_type <> 'fleet_courier'
        OR oa.payload->>'canonical_account_type' <> 'fleet_courier'
      )
  ) THEN
    RAISE EXCEPTION 'Legacy Fleet onboarding canonical type convergence is incomplete.';
  END IF;

  -- Every unambiguous pending legacy Fleet company must now be linked to its
  -- canonical onboarding application, while remaining pending/invited.
  IF EXISTS (
    SELECT 1
    FROM public.companies c
    JOIN auth.users u ON u.id = c.created_by
    JOIN public.profiles p ON p.user_id = c.created_by AND p.company_id = c.id
    JOIN public.company_memberships cm
      ON cm.user_id = c.created_by
     AND cm.company_id = c.id
     AND cm.role_in_company = 'owner'
     AND cm.status::text = 'invited'
    WHERE c.status::text = 'pending_approval'
      AND lower(COALESCE(u.raw_user_meta_data->>'requested_role', '')) = 'fleet_operator'
      AND lower(COALESCE(u.raw_user_meta_data->>'signup_type', '')) = 'fleet_operator'
      AND lower(COALESCE(u.raw_user_meta_data->>'account_type', '')) = 'fleet_operator'
      AND (SELECT count(*) FROM public.companies c2 WHERE c2.created_by = c.created_by) = 1
      AND (SELECT count(*) FROM public.company_memberships cm2 WHERE cm2.user_id = c.created_by) = 1
      AND NOT EXISTS (
        SELECT 1
        FROM public.onboarding_applications oa
        WHERE oa.user_id = c.created_by
          AND oa.company_id = c.id
          AND oa.account_type = 'fleet_courier'
          AND oa.payload->>'legacy_company_binding_reconciled' = 'true'
      )
  ) THEN
    RAISE EXCEPTION 'An unambiguous pending legacy Fleet company remains unbound.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    JOIN public.companies c ON c.id = oa.company_id
    JOIN public.company_memberships cm
      ON cm.user_id = oa.user_id
     AND cm.company_id = c.id
    WHERE oa.payload->>'legacy_company_binding_reconciled' = 'true'
      AND (
        c.status::text <> 'pending_approval'
        OR c.company_type <> 'carrier'
        OR cm.role_in_company <> 'owner'
        OR cm.status::text <> 'invited'
      )
  ) THEN
    RAISE EXCEPTION 'Reconciled legacy Fleet binding changed governance state unexpectedly.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.payload->>'legacy_company_binding_reconciled' = 'true'
      AND oa.status NOT IN ('draft', 'in_progress', 'request_changes', 'under_review')
  ) THEN
    RAISE EXCEPTION 'Legacy Fleet reconciliation unexpectedly approved/rejected an application.';
  END IF;
END;
$$;

COMMIT;
