-- POD P0 lifecycle compatibility hardening
--
-- The platform currently has three legitimate execution clients:
-- 1) operator/admin API: coarse jobs.status + detailed jobs.current_status
-- 2) driver mobile API: coarse jobs.status including collected/in_transit + detailed current_status
-- 3) native Android RPC: detailed status values are written to both columns
--
-- This migration keeps the DB guardrail strict while accepting the union of those
-- canonical execution paths. It also makes POD storage path parsing fail closed
-- instead of raising on a malformed first path segment.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Safe job-id extraction from canonical POD storage paths.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pod_job_id_from_storage_name(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_first_segment text;
BEGIN
  v_first_segment := split_part(coalesce(p_name, ''), '/', 1);
  IF v_first_segment = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_first_segment::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.pod_job_id_from_storage_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pod_job_id_from_storage_name(text) TO authenticated, service_role;

DROP POLICY IF EXISTS pod_photos_insert_relationship_v2 ON storage.objects;
DROP POLICY IF EXISTS pod_photos_select_relationship_v2 ON storage.objects;

CREATE POLICY pod_photos_insert_relationship_v2
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pod-photos'
  AND public.pod_job_id_from_storage_name(name) IS NOT NULL
  AND (
    public.can_driver_manage_job_pod(public.pod_job_id_from_storage_name(name))
    OR public.can_manage_job_pod(public.pod_job_id_from_storage_name(name))
  )
  AND (storage.foldername(name))[2] IN ('photos', 'documents', 'signatures')
);

CREATE POLICY pod_photos_select_relationship_v2
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pod-photos'
  AND public.pod_job_id_from_storage_name(name) IS NOT NULL
  AND public.can_view_job_pod(public.pod_job_id_from_storage_name(name))
);

-- -----------------------------------------------------------------------------
-- 2. Reconcile DB lifecycle guardrails with all currently supported clients.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_jobs_mvp_guardrails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_allowed_next text[];
  v_carrier_company_id uuid;
  v_issues text[];
BEGIN
  v_new_status := lower(coalesce(NEW.status::text, ''));
  v_old_status := CASE
    WHEN TG_OP = 'UPDATE' THEN lower(coalesce(OLD.status::text, ''))
    ELSE ''
  END;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_allowed_next := CASE v_old_status
      WHEN 'draft' THEN ARRAY['posted', 'cancelled', 'disputed']
      WHEN 'posted' THEN ARRAY['quoted', 'awarded', 'allocated', 'cancelled', 'disputed']
      WHEN 'quoted' THEN ARRAY['posted', 'awarded', 'allocated', 'cancelled', 'disputed']
      WHEN 'awarded' THEN ARRAY['allocated', 'on_my_way', 'cancelled', 'disputed']
      WHEN 'allocated' THEN ARRAY['on_my_way', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'cancelled', 'disputed']
      WHEN 'on_my_way' THEN ARRAY['on_site_pickup', 'cancelled', 'disputed']
      WHEN 'on_site_pickup' THEN ARRAY['loaded', 'cancelled', 'disputed']
      WHEN 'loaded' THEN ARRAY['collected', 'in_transit', 'on_site_delivery', 'cancelled', 'disputed']
      WHEN 'collected' THEN ARRAY['in_transit', 'on_site_delivery', 'cancelled', 'disputed']
      WHEN 'in_transit' THEN ARRAY['on_site_delivery', 'delivered', 'cancelled', 'disputed']
      WHEN 'on_site_delivery' THEN ARRAY['delivered', 'cancelled', 'disputed']
      WHEN 'delivered' THEN ARRAY['completed']
      WHEN 'completed' THEN ARRAY[]::text[]
      WHEN 'cancelled' THEN ARRAY[]::text[]
      WHEN 'disputed' THEN ARRAY[]::text[]
      ELSE ARRAY[]::text[]
    END;

    IF NOT (v_new_status = ANY (v_allowed_next)) THEN
      RAISE EXCEPTION 'Invalid job status transition: % -> %', OLD.status, NEW.status
        USING ERRCODE = '23514';
    END IF;

    -- Delivery is independently protected by fn_require_canonical_pod_for_delivery,
    -- but keep the explicit check here as defense in depth for status-based writes.
    IF v_new_status IN ('delivered', 'completed')
       AND NOT public.is_job_pod_valid(NEW.id)
    THEN
      RAISE EXCEPTION 'POD incomplete: valid stored POD is required before delivery completion.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.exchange_visibility = 'exchange'
     AND (TG_OP = 'INSERT' OR coalesce(OLD.exchange_visibility, '') <> 'exchange')
  THEN
    v_issues := public.company_compliance_issues(NEW.company_id, 'publish');
    IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Compliance blocked publish action: %', array_to_string(v_issues, ' ');
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)
  THEN
    IF v_new_status IN (
      'awarded',
      'allocated',
      'on_my_way',
      'on_site_pickup',
      'loaded',
      'collected',
      'in_transit',
      'on_site_delivery',
      'delivered',
      'completed'
    ) THEN
      v_carrier_company_id := coalesce(
        NEW.awarded_carrier_company_id,
        NEW.assigned_company_id,
        NEW.company_id
      );
      v_issues := public.company_compliance_issues(v_carrier_company_id, 'execution');
      IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Compliance blocked execution action: %', array_to_string(v_issues, ' ');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.pod_job_id_from_storage_name(text) IS
  'Safely extracts the job UUID from pod-photos/{job_id}/... paths; malformed paths return NULL.';

NOTIFY pgrst, 'reload schema';

COMMIT;
