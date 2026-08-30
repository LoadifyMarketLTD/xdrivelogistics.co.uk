BEGIN;

-- P0-04 production proof: a direct service-role governance call cannot activate
-- a company that lacks the canonical compliance/onboarding evidence.
DO $$
DECLARE
  v_company_id uuid;
  v_actor_user_id uuid;
  v_original_status text;
  v_audit_before bigint;
  v_audit_after bigint;
  v_rejected boolean := false;
BEGIN
  SELECT c.id, c.created_by, c.status::text
  INTO v_company_id, v_actor_user_id, v_original_status
  FROM public.companies c
  WHERE c.status::text = 'pending_approval'
    AND c.created_by IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.user_id = c.created_by
        AND (oa.company_id = c.id OR oa.company_id IS NULL)
    )
  ORDER BY c.created_at
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_audit_before
  FROM public.owner_audit_log
  WHERE target_type = 'company'
    AND target_id = v_company_id;

  BEGIN
    PERFORM *
    FROM public.set_company_status_governance(
      v_actor_user_id,
      v_company_id,
      'runtime_compliance_gate_proof',
      'active',
      'Transactional P0-04 runtime proof'
    );
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Non-compliant company activation was not rejected by governance RPC.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = v_company_id
      AND status::text = v_original_status
  ) THEN
    RAISE EXCEPTION 'Rejected company activation changed company status.';
  END IF;

  SELECT count(*) INTO v_audit_after
  FROM public.owner_audit_log
  WHERE target_type = 'company'
    AND target_id = v_company_id;

  IF v_audit_after IS DISTINCT FROM v_audit_before THEN
    RAISE EXCEPTION 'Rejected company activation wrote a governance audit row.';
  END IF;
END;
$$;

COMMIT;
