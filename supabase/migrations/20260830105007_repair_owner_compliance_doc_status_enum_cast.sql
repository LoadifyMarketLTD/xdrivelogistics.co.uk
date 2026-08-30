BEGIN;

CREATE OR REPLACE FUNCTION public.owner_review_compliance_document(
  p_actor_user_id uuid,
  p_document_family text,
  p_document_id uuid,
  p_action text,
  p_reason text DEFAULT NULL::text
)
RETURNS TABLE(document_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_table text;
  v_status_column text;
  v_reviewer_column text;
  v_reviewed_at_column text;
  v_reason_column text;
  v_target_name text;
  v_old_status text;
  v_next_status text;
  v_reason text;
BEGIN
  IF p_document_family NOT IN ('driver', 'vehicle', 'company', 'identity') THEN
    RAISE EXCEPTION 'Unsupported document family.'
      USING ERRCODE = '23514';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Unsupported document review action.'
      USING ERRCODE = '23514';
  END IF;

  IF p_document_family = 'driver' THEN
    v_table := 'driver_documents';
    v_status_column := 'status';
    v_reviewer_column := 'verified_by';
    v_reviewed_at_column := 'verified_at';
    v_reason_column := 'rejection_reason';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;
  ELSIF p_document_family = 'vehicle' THEN
    v_table := 'vehicle_documents';
    v_status_column := 'status';
    v_reviewer_column := 'verified_by';
    v_reviewed_at_column := 'verified_at';
    v_reason_column := 'rejection_reason';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;
  ELSIF p_document_family = 'company' THEN
    v_table := 'company_documents';
    v_status_column := 'status';
    v_reviewer_column := 'reviewed_by';
    v_reviewed_at_column := 'reviewed_at';
    v_reason_column := 'review_notes';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;
  ELSE
    v_table := 'driver_identity_documents';
    v_status_column := 'verification_status';
    v_reviewer_column := 'reviewed_by';
    v_reviewed_at_column := 'reviewed_at';
    v_reason_column := 'review_notes';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'verified' ELSE 'rejected' END;
  END IF;

  v_target_name := format('%s document %s', p_document_family, p_document_id);

  EXECUTE format(
    'SELECT %1$I::text FROM public.%2$I WHERE id = $1 FOR UPDATE',
    v_status_column,
    v_table
  )
  INTO v_old_status
  USING p_document_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002';
  END IF;

  v_reason := CASE
    WHEN p_action = 'reject' THEN COALESCE(NULLIF(trim(p_reason), ''), 'Rejected by platform compliance review.')
    ELSE NULL
  END;

  IF p_document_family = 'driver' THEN
    EXECUTE format(
      'UPDATE public.%1$I
       SET %2$I = $2::public.doc_status,
           %3$I = $3,
           %4$I = now(),
           %5$I = $4
       WHERE id = $1',
      v_table,
      v_status_column,
      v_reviewer_column,
      v_reviewed_at_column,
      v_reason_column
    )
    USING p_document_id, v_next_status, p_actor_user_id, v_reason;
  ELSE
    EXECUTE format(
      'UPDATE public.%1$I
       SET %2$I = $2,
           %3$I = $3,
           %4$I = now(),
           %5$I = $4
       WHERE id = $1',
      v_table,
      v_status_column,
      v_reviewer_column,
      v_reviewed_at_column,
      v_reason_column
    )
    USING p_document_id, v_next_status, p_actor_user_id, v_reason;
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
    v_target_name,
    NULL,
    CASE WHEN p_action = 'approve' THEN 'document_approved' ELSE 'document_rejected' END,
    v_old_status,
    v_next_status,
    COALESCE(NULLIF(trim(p_reason), ''), format('%s document %s %s by platform compliance.', p_document_family, p_document_id, v_next_status)),
    jsonb_build_object(
      'document_id', p_document_id,
      'document_family', p_document_family
    )
  );

  RETURN QUERY SELECT p_document_id, v_old_status, v_next_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_review_compliance_document(uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_review_compliance_document(uuid, text, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.owner_review_compliance_document(uuid, text, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.owner_review_compliance_document(uuid, text, uuid, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
