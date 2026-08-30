DO $validation$
DECLARE
  v_actor_user_id uuid;
  v_company_id uuid;
  v_job_id uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  SELECT cm.user_id, cm.company_id
  INTO v_actor_user_id, v_company_id
  FROM public.company_memberships cm
  JOIN public.companies c ON c.id = cm.company_id
  WHERE cm.status = 'active'
    AND cm.role_in_company::text IN ('owner', 'admin', 'dispatcher')
    AND c.status::text = 'active'
  ORDER BY cm.created_at ASC NULLS LAST
  LIMIT 1;

  -- Production had an active posting-company operator and therefore executed
  -- the full success-path validation when this migration was applied. Fresh or
  -- branch databases can legitimately contain no account data yet, so replay
  -- must remain deterministic and skip the data-dependent probe in that case.
  IF v_actor_user_id IS NULL OR v_company_id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.jobs(
      id,
      company_id,
      created_by,
      pickup_location,
      delivery_location,
      pickup_datetime,
      status,
      current_status,
      exchange_visibility,
      is_test,
      customer_ref
    )
    VALUES (
      v_job_id,
      v_company_id,
      v_actor_user_id,
      'XDrive atomic-delete synthetic pickup',
      'XDrive atomic-delete synthetic delivery',
      now() + interval '1 day',
      'draft',
      'draft',
      'private',
      true,
      'XDRV-ATOMIC-' || upper(left(v_job_id::text, 8))
    );

    v_result := public.delete_unbid_exchange_job_atomic(v_job_id, v_actor_user_id);

    IF coalesce(v_result ->> 'status', '') <> 'deleted' THEN
      RAISE EXCEPTION 'Atomic owner-delete validation returned unexpected result: %', v_result;
    END IF;

    IF EXISTS (SELECT 1 FROM public.jobs WHERE id = v_job_id) THEN
      RAISE EXCEPTION 'Atomic owner-delete validation did not delete the synthetic job.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.owner_audit_log
      WHERE target_id = v_job_id
        AND action_type = 'exchange_load_deleted_without_bids'
        AND metadata ->> 'source' = 'workspace_owner_delete'
    ) THEN
      RAISE EXCEPTION 'Atomic owner-delete validation did not write the expected audit record.';
    END IF;

    RAISE EXCEPTION 'xdrive_atomic_delete_validation_rollback' USING ERRCODE = 'PZ001';
  EXCEPTION
    WHEN SQLSTATE 'PZ001' THEN
      IF SQLERRM <> 'xdrive_atomic_delete_validation_rollback' THEN
        RAISE;
      END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.jobs WHERE id = v_job_id) THEN
    RAISE EXCEPTION 'Synthetic job remained after validation rollback.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.owner_audit_log WHERE target_id = v_job_id) THEN
    RAISE EXCEPTION 'Synthetic audit record remained after validation rollback.';
  END IF;
END;
$validation$;
