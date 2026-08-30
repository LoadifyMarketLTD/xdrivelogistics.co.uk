BEGIN;

-- P0-03 production proof. Invalid authority changes are exercised inside
-- exception subtransactions and deliberately rolled back.
DO $$
DECLARE
  v_pending_company_id uuid;
  v_pending_user_id uuid;
  v_active_company_id uuid;
  v_active_user_id uuid;
  v_original_company_status text;
  v_original_membership_status text;
BEGIN
  SELECT c.id, cm.user_id
  INTO v_pending_company_id, v_pending_user_id
  FROM public.companies c
  JOIN public.company_memberships cm ON cm.company_id = c.id
  WHERE c.status::text = 'pending_approval'
    AND cm.status = 'invited'
  ORDER BY c.created_at, cm.created_at
  LIMIT 1;

  IF v_pending_company_id IS NOT NULL THEN
    BEGIN
      UPDATE public.company_memberships
      SET status = 'active', updated_at = now()
      WHERE company_id = v_pending_company_id
        AND user_id = v_pending_user_id;

      IF EXISTS (
        SELECT 1
        FROM public.company_memberships
        WHERE company_id = v_pending_company_id
          AND user_id = v_pending_user_id
          AND status = 'active'
      ) THEN
        RAISE EXCEPTION 'Pending company membership activation escaped governance guard.';
      END IF;

      RAISE EXCEPTION USING ERRCODE = 'PZ031', MESSAGE = 'rollback pending-company membership proof';
    EXCEPTION WHEN SQLSTATE 'PZ031' THEN
      NULL;
    END;
  END IF;

  SELECT c.id, c.created_by, c.status::text, cm.status
  INTO v_active_company_id, v_active_user_id, v_original_company_status, v_original_membership_status
  FROM public.companies c
  JOIN public.company_memberships cm
    ON cm.company_id = c.id
   AND cm.user_id = c.created_by
  WHERE c.status::text = 'active'
    AND cm.status = 'active'
    AND c.created_by IS NOT NULL
  ORDER BY c.created_at
  LIMIT 1;

  IF v_active_company_id IS NOT NULL THEN
    BEGIN
      PERFORM *
      FROM public.set_company_status_governance(
        v_active_user_id,
        v_active_company_id,
        'runtime_company_membership_governance_proof',
        'suspended',
        'Transactional P0-03 runtime proof'
      );

      IF EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_id = v_active_company_id
          AND status = 'active'
      ) THEN
        RAISE EXCEPTION 'Company suspension did not revoke active memberships.';
      END IF;

      RAISE EXCEPTION USING ERRCODE = 'PZ032', MESSAGE = 'rollback company suspension proof';
    EXCEPTION WHEN SQLSTATE 'PZ032' THEN
      NULL;
    END;

    IF NOT EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.company_memberships cm
        ON cm.company_id = c.id
       AND cm.user_id = v_active_user_id
      WHERE c.id = v_active_company_id
        AND c.status::text = v_original_company_status
        AND cm.status = v_original_membership_status
    ) THEN
      RAISE EXCEPTION 'Company suspension runtime proof did not roll back cleanly.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.status = 'active'
      AND c.status::text <> 'active'
  ) THEN
    RAISE EXCEPTION 'Runtime proof finished with active membership on non-active company.';
  END IF;
END;
$$;

COMMIT;
