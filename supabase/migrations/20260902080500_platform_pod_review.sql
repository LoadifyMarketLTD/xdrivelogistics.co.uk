BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Platform Owner POD review state is deliberately isolated from public.jobs.
-- Authenticated tenant roles can read/update jobs rows under RLS, so internal
-- Platform Owner review provenance must not live in tenant-visible columns.
CREATE TABLE IF NOT EXISTS public.platform_pod_reviews (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('approved', 'rejected', 'missing_requested')),
  note text NOT NULL,
  reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_pod_reviews_status_reviewed_at
  ON public.platform_pod_reviews(status, reviewed_at DESC);

ALTER TABLE public.platform_pod_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_pod_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_pod_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.owner_review_job_pod(
  p_actor_user_id uuid,
  p_job_id uuid,
  p_action text,
  p_reason text
)
RETURNS TABLE (
  id uuid,
  job_status text,
  platform_pod_review_status text,
  platform_pod_reviewed_by uuid,
  platform_pod_reviewed_at timestamptz,
  platform_pod_review_note text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_action text := lower(btrim(COALESCE(p_action, '')));
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_target_status text;
  v_company_id uuid;
  v_job_status text;
  v_job_reference text;
  v_old_review text;
  v_signature_present boolean := false;
  v_delivery_photo_count integer := 0;
  v_pod_photo_count integer := 0;
  v_hard_copy_present boolean := false;
  v_has_physical_evidence boolean := false;
  v_evidence_snapshot jsonb;
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'job_id is required for Platform POD review.' USING ERRCODE = '23502';
  END IF;
  IF v_action NOT IN ('approve', 'reject', 'request_missing') THEN
    RAISE EXCEPTION 'Unsupported Platform POD review action: %', v_action USING ERRCODE = '23514';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 5 THEN
    RAISE EXCEPTION 'A review reason of at least 5 characters is required.' USING ERRCODE = '23514';
  END IF;

  v_target_status := CASE
    WHEN v_action = 'approve' THEN 'approved'
    WHEN v_action = 'reject' THEN 'rejected'
    ELSE 'missing_requested'
  END;

  SELECT
    j.company_id,
    j.status::text,
    COALESCE(j.load_ref, j.load_id, j.load_reference, j.booking_reference, j.id::text),
    COALESCE(
      j.delivery_signature_data IS NOT NULL
      AND j.delivery_signature_data <> 'null'::jsonb
      AND j.delivery_signature_data <> '{}'::jsonb,
      false
    ),
    CASE
      WHEN jsonb_typeof(j.delivery_photos) = 'array' THEN jsonb_array_length(j.delivery_photos)
      ELSE 0
    END,
    CASE
      WHEN jsonb_typeof(j.pod_photos) = 'array' THEN jsonb_array_length(j.pod_photos)
      ELSE 0
    END,
    COALESCE(NULLIF(btrim(j.hard_copy_pod), '') IS NOT NULL, false)
  INTO
    v_company_id,
    v_job_status,
    v_job_reference,
    v_signature_present,
    v_delivery_photo_count,
    v_pod_photo_count,
    v_hard_copy_present
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT r.status
  INTO v_old_review
  FROM public.platform_pod_reviews r
  WHERE r.job_id = p_job_id;

  v_has_physical_evidence :=
    v_signature_present
    OR v_delivery_photo_count > 0
    OR v_pod_photo_count > 0
    OR v_hard_copy_present;

  IF v_action = 'approve' AND NOT v_has_physical_evidence THEN
    RAISE EXCEPTION 'Cannot approve POD without physical delivery evidence.' USING ERRCODE = '23514';
  END IF;

  v_evidence_snapshot := jsonb_build_object(
    'signature_present', v_signature_present,
    'delivery_photo_count', v_delivery_photo_count,
    'pod_photo_count', v_pod_photo_count,
    'hard_copy_present', v_hard_copy_present,
    'physical_evidence_present', v_has_physical_evidence
  );

  INSERT INTO public.platform_pod_reviews (
    job_id,
    status,
    note,
    reviewed_by,
    reviewed_at,
    evidence_snapshot,
    created_at,
    updated_at
  )
  VALUES (
    p_job_id,
    v_target_status,
    v_reason,
    p_actor_user_id,
    now(),
    v_evidence_snapshot,
    now(),
    now()
  )
  ON CONFLICT (job_id) DO UPDATE
  SET
    status = EXCLUDED.status,
    note = EXCLUDED.note,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    evidence_snapshot = EXCLUDED.evidence_snapshot,
    updated_at = now();

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
    metadata,
    created_at
  )
  VALUES (
    p_actor_user_id,
    'job',
    p_job_id,
    v_job_reference,
    v_company_id,
    'platform_pod_' || v_action,
    COALESCE(v_old_review, 'unreviewed'),
    v_target_status,
    v_reason,
    v_evidence_snapshot || jsonb_build_object(
      'job_status', v_job_status,
      'authority', 'platform_owner',
      'review_registry', 'platform_pod_reviews'
    ),
    now()
  );

  RETURN QUERY
  SELECT
    j.id,
    j.status::text,
    r.status,
    r.reviewed_by,
    r.reviewed_at,
    r.note
  FROM public.jobs j
  JOIN public.platform_pod_reviews r ON r.job_id = j.id
  WHERE j.id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_review_job_pod(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_review_job_pod(uuid, uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
