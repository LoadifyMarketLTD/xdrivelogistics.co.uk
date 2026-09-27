BEGIN;

CREATE OR REPLACE FUNCTION public.owner_request_compliance_document_update(
  p_actor_user_id uuid,
  p_document_family text,
  p_document_id uuid,
  p_reason text
)
RETURNS TABLE (
  document_id uuid,
  old_status text,
  new_status text,
  company_id uuid,
  notification_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_old_status text;
  v_company_id uuid;
  v_subject_user_id uuid;
  v_doc_type text;
  v_existing_reason text;
  v_reason text;
  v_stored_reason text;
  v_notification_count integer := 0;
BEGIN
  IF p_document_family NOT IN ('driver', 'vehicle', 'company', 'identity') THEN
    RAISE EXCEPTION 'Unsupported document family.' USING ERRCODE = '23514';
  END IF;

  v_reason := NULLIF(trim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required when requesting a document update.' USING ERRCODE = '23514';
  END IF;
  v_stored_reason := 'Update requested: ' || v_reason;

  IF p_document_family = 'driver' THEN
    SELECT dd.status::text, d.company_id, d.user_id, dd.doc_type, dd.rejection_reason
      INTO v_old_status, v_company_id, v_subject_user_id, v_doc_type, v_existing_reason
    FROM public.driver_documents dd
    JOIN public.drivers d ON d.id = dd.driver_id
    WHERE dd.id = p_document_id
    FOR UPDATE OF dd;

    IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002'; END IF;

    IF v_old_status = 'rejected' AND v_existing_reason = v_stored_reason THEN
      RETURN QUERY SELECT p_document_id, v_old_status, v_old_status, v_company_id, 0;
      RETURN;
    END IF;

    UPDATE public.driver_documents
    SET status = 'rejected'::public.doc_status,
        verified_by = p_actor_user_id,
        verified_at = now(),
        rejection_reason = v_stored_reason
    WHERE id = p_document_id;

  ELSIF p_document_family = 'vehicle' THEN
    SELECT vd.status::text, v.company_id, NULL::uuid, vd.doc_type, vd.rejection_reason
      INTO v_old_status, v_company_id, v_subject_user_id, v_doc_type, v_existing_reason
    FROM public.vehicle_documents vd
    JOIN public.vehicles v ON v.id = vd.vehicle_id
    WHERE vd.id = p_document_id
    FOR UPDATE OF vd;

    IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002'; END IF;

    IF v_old_status = 'rejected' AND v_existing_reason = v_stored_reason THEN
      RETURN QUERY SELECT p_document_id, v_old_status, v_old_status, v_company_id, 0;
      RETURN;
    END IF;

    UPDATE public.vehicle_documents
    SET status = 'rejected',
        verified_by = p_actor_user_id,
        verified_at = now(),
        rejection_reason = v_stored_reason
    WHERE id = p_document_id;

  ELSIF p_document_family = 'company' THEN
    SELECT cd.status::text, cd.company_id, oa.user_id, cd.doc_type, cd.review_notes
      INTO v_old_status, v_company_id, v_subject_user_id, v_doc_type, v_existing_reason
    FROM public.company_documents cd
    LEFT JOIN public.onboarding_applications oa ON oa.id = cd.onboarding_application_id
    WHERE cd.id = p_document_id
    FOR UPDATE OF cd;

    IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002'; END IF;

    IF v_old_status = 'rejected' AND v_existing_reason = v_stored_reason THEN
      RETURN QUERY SELECT p_document_id, v_old_status, v_old_status, v_company_id, 0;
      RETURN;
    END IF;

    UPDATE public.company_documents
    SET status = 'rejected',
        reviewed_by = p_actor_user_id,
        reviewed_at = now(),
        review_notes = v_stored_reason
    WHERE id = p_document_id;

  ELSE
    SELECT did.verification_status::text, oa.company_id, oa.user_id, did.doc_type, did.review_notes
      INTO v_old_status, v_company_id, v_subject_user_id, v_doc_type, v_existing_reason
    FROM public.driver_identity_documents did
    JOIN public.onboarding_applications oa ON oa.id = did.onboarding_application_id
    WHERE did.id = p_document_id
    FOR UPDATE OF did;

    IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002'; END IF;

    IF v_old_status = 'rejected' AND v_existing_reason = v_stored_reason THEN
      RETURN QUERY SELECT p_document_id, v_old_status, v_old_status, v_company_id, 0;
      RETURN;
    END IF;

    UPDATE public.driver_identity_documents
    SET verification_status = 'rejected',
        reviewed_by = p_actor_user_id,
        reviewed_at = now(),
        review_notes = v_stored_reason
    WHERE id = p_document_id;
  END IF;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_id,
    target_name,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    metadata
  )
  VALUES (
    p_actor_user_id,
    'compliance_document',
    p_document_id,
    format('%s document %s', p_document_family, COALESCE(v_doc_type, p_document_id::text)),
    v_company_id,
    'document_update_requested',
    v_old_status,
    'rejected',
    v_reason,
    jsonb_build_object(
      'document_id', p_document_id,
      'document_family', p_document_family,
      'doc_type', v_doc_type,
      'request_kind', 'replacement_required'
    )
  );

  WITH recipients AS (
    SELECT v_subject_user_id AS user_id
    WHERE v_subject_user_id IS NOT NULL
    UNION
    SELECT cm.user_id
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE v_company_id IS NOT NULL
      AND cm.company_id = v_company_id
      AND cm.status::text = 'active'
      AND cm.role_in_company::text IN ('owner', 'admin', 'fleet_manager')
      AND c.status::text = 'active'
  ),
  inserted AS (
    INSERT INTO public.notification_events (
      event_type,
      entity_type,
      entity_id,
      company_id,
      recipient_user_id,
      payload,
      idempotency_key
    )
    SELECT
      'compliance_document_update_requested',
      'compliance_document',
      p_document_id,
      v_company_id,
      r.user_id,
      jsonb_build_object(
        'message', format('A replacement %s document is required. %s', COALESCE(v_doc_type, p_document_family), v_reason),
        'document_id', p_document_id,
        'document_family', p_document_family,
        'doc_type', v_doc_type,
        'reason', v_reason
      ),
      'compliance-update:' || p_document_family || ':' || p_document_id::text || ':' || r.user_id::text || ':' || md5(v_reason)
    FROM recipients r
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer INTO v_notification_count FROM inserted;

  RETURN QUERY SELECT p_document_id, v_old_status, 'rejected'::text, v_company_id, v_notification_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_request_compliance_document_update(uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_request_compliance_document_update(uuid, text, uuid, text)
  TO service_role;

COMMIT;
