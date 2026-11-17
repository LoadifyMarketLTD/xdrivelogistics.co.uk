BEGIN;

CREATE OR REPLACE FUNCTION public.decide_awarded_job_cancellation_atomic(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.job_cancellation_requests%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_actor_company_id uuid;
  v_actor_party text;
  v_decision text := lower(trim(COALESCE(p_decision, '')));
BEGIN
  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION
      'Decision must be approved or rejected.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_request
  FROM public.job_cancellation_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Cancellation request not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION
      'This cancellation request has already been decided.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = v_request.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT cm.company_id
  INTO v_actor_company_id
  FROM public.company_memberships cm
  WHERE cm.user_id = p_actor_user_id
    AND cm.status = 'active'
    AND cm.role_in_company::text IN ('owner', 'admin', 'dispatcher')
    AND cm.company_id IN (
      v_request.owner_company_id,
      v_request.carrier_company_id
    )
  ORDER BY CASE
    WHEN cm.company_id = v_request.owner_company_id THEN 0
    ELSE 1
  END
  LIMIT 1;

  IF v_actor_company_id = v_request.owner_company_id THEN
    v_actor_party := 'load_owner';
  ELSIF v_actor_company_id = v_request.carrier_company_id THEN
    v_actor_party := 'carrier';
  END IF;

  IF v_actor_company_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = v_job.assigned_driver_id
        AND d.user_id = p_actor_user_id
        AND d.status = 'active'
    ) THEN
      v_actor_company_id := v_request.carrier_company_id;
      v_actor_party := 'carrier';
    END IF;
  END IF;

  IF v_actor_company_id IS NULL
     OR v_actor_party IS NULL
     OR v_actor_party = v_request.requester_party THEN
    RAISE EXCEPTION
      'Only the other party may decide this cancellation request.'
      USING ERRCODE = '42501';
  END IF;

  IF v_decision = 'approved' THEN
    IF v_job.status::text IN (
      'delivered', 'invoiced', 'paid', 'cancelled', 'disputed'
    ) THEN
      RAISE EXCEPTION
        'The job can no longer be cancelled.'
        USING ERRCODE = '23514';
    END IF;

    -- Fail closed while goods remain physically unresolved.
    -- A cancellation instruction may be recorded immediately, but commercial
    -- cancellation cannot close the parent job before an authorised return /
    -- redirect has been completed and evidenced.
    IF EXISTS (
      SELECT 1
      FROM public.job_stops js
      WHERE js.job_id = v_job.id
        AND (
          (
            COALESCE(js.handover->>'stopKind', '') IN ('return', 'redirect')
            AND (
              js.status <> 'completed'
              OR js.completed_at IS NULL
              OR NULLIF(trim(COALESCE(js.handover->>'recipientName','')),'') IS NULL
              OR NULLIF(trim(COALESCE(js.handover->>'signaturePath','')),'') IS NULL
              OR NOT COALESCE(js.handover->>'signaturePath' LIKE
                v_job.assigned_company_id::text || '/' || v_job.id::text || '/stops/' || js.id::text || '/signature/%', false)
              OR EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(js.handover->'photoPaths') = 'array'
                  THEN js.handover->'photoPaths' ELSE '[]'::jsonb END) AS photo(path)
                WHERE photo.path NOT LIKE
                  v_job.assigned_company_id::text || '/' || v_job.id::text || '/stops/' || js.id::text || '/photos/%'
              )
              OR jsonb_typeof(js.handover->'photoPaths') IS DISTINCT FROM 'array'
              OR jsonb_array_length(CASE WHEN jsonb_typeof(js.handover->'photoPaths') = 'array'
                THEN js.handover->'photoPaths' ELSE '[]'::jsonb END) = 0
            )
          )
          OR (
            COALESCE((js.handover->'returnInstruction'->>'resolutionRequired')::boolean, false) = true
          )
        )
    ) THEN
      RAISE EXCEPTION
        'Goods remain in custody or an authorised return/redirect is unresolved. Complete the physical resolution and evidence before approving cancellation.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.job_cancellation_requests
  SET status = v_decision,
      decided_by_user_id = p_actor_user_id,
      decision_notes = NULLIF(trim(p_notes), ''),
      decided_at = now(),
      updated_at = now()
  WHERE id = p_request_id;

  IF v_decision = 'approved' THEN
    UPDATE public.jobs
    SET status = 'cancelled',
        current_status = 'cancelled',
        exchange_visibility = 'private',
        updated_at = now()
    WHERE id = v_job.id;

    UPDATE public.loads
    SET status = 'cancelled'
    WHERE job_id = v_job.id;
  END IF;

  INSERT INTO public.owner_audit_log(
    actor_user_id,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason
  )
  VALUES (
    p_actor_user_id,
    v_request.owner_company_id,
    'job_cancellation_' || v_decision,
    COALESCE(v_job.current_status::text, v_job.status::text),
    CASE
      WHEN v_decision = 'approved' THEN 'cancelled'
      ELSE COALESCE(v_job.current_status::text, v_job.status::text)
    END,
    COALESCE(
      NULLIF(trim(p_notes), ''),
      'Cancellation request ' || v_decision || '.'
    )
  );

  RETURN jsonb_build_object(
    'requestId', p_request_id,
    'jobId', v_job.id,
    'status', v_decision
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.decide_awarded_job_cancellation_atomic(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_awarded_job_cancellation_atomic(uuid, uuid, text, text)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
