BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- SA-08: Platform Owner POD review is intentionally separate from
-- broker_pod_review_* tenant fields. Platform authority must not impersonate
-- or overwrite broker review provenance.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS platform_pod_review_status text,
  ADD COLUMN IF NOT EXISTS platform_pod_review_note text,
  ADD COLUMN IF NOT EXISTS platform_pod_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_pod_reviewed_at timestamptz;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_platform_pod_review_status_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_platform_pod_review_status_check
  CHECK (
    platform_pod_review_status IS NULL
    OR platform_pod_review_status IN ('approved', 'rejected', 'missing_requested')
  );

CREATE INDEX IF NOT EXISTS idx_jobs_platform_pod_review_status
  ON public.jobs(platform_pod_review_status, updated_at DESC)
  WHERE platform_pod_review_status IS NOT NULL;

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
  v_company_id uuid;
  v_job_status text;
  v_job_reference text;
  v_old_review text;
  v_signature_present boolean := false;
  v_delivery_photo_count integer := 0;
  v_pod_photo_count integer := 0;
  v_hard_copy_present boolean := false;
  v_has_physical_evidence boolean := false;
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

  SELECT
    j.company_id,
    j.status::text,
    COALESCE(j.load_ref, j.load_id, j.load_reference, j.booking_reference, j.id::text),
    j.platform_pod_review_status,
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
    v_old_review,
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

  v_has_physical_evidence :=
    v_signature_present
    OR v_delivery_photo_count > 0
    OR v_pod_photo_count > 0
    OR v_hard_copy_present;

  IF v_action = 'approve' AND NOT v_has_physical_evidence THEN
    RAISE EXCEPTION 'Cannot approve POD without physical delivery evidence.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.jobs
  SET
    platform_pod_review_status = CASE
      WHEN v_action = 'approve' THEN 'approved'
      WHEN v_action = 'reject' THEN 'rejected'
      ELSE 'missing_requested'
    END,
    platform_pod_review_note = v_reason,
    platform_pod_reviewed_by = p_actor_user_id,
    platform_pod_reviewed_at = now()
  WHERE public.jobs.id = p_job_id;

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
    CASE
      WHEN v_action = 'approve' THEN 'approved'
      WHEN v_action = 'reject' THEN 'rejected'
      ELSE 'missing_requested'
    END,
    v_reason,
    jsonb_build_object(
      'job_status', v_job_status,
      'signature_present', v_signature_present,
      'delivery_photo_count', v_delivery_photo_count,
      'pod_photo_count', v_pod_photo_count,
      'hard_copy_present', v_hard_copy_present,
      'physical_evidence_present', v_has_physical_evidence,
      'authority', 'platform_owner'
    ),
    now()
  );

  RETURN QUERY
  SELECT
    j.id,
    j.status::text,
    j.platform_pod_review_status,
    j.platform_pod_reviewed_by,
    j.platform_pod_reviewed_at,
    j.platform_pod_review_note
  FROM public.jobs j
  WHERE j.id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_review_job_pod(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_review_job_pod(uuid, uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
