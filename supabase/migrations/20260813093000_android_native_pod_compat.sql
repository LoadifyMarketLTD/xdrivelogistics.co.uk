-- Android native POD compatibility bridge
--
-- Transitional compatibility only. The canonical target remains:
--   pod-photos/{job_id}/{photos|documents|signatures}/...
--
-- The current native Android client still uploads signed POD evidence to:
--   pod-docs/driver-{driver_id}/{job_id}/{filename}
-- and then records recipient/evidence metadata on jobs before calling
-- driver_update_job_status_atomic().
--
-- This migration keeps the hard invariant intact:
--   no verified POD -> no Delivered/Completed.
-- It materialises a structured proof_of_delivery row before the Delivered update,
-- records the legacy storage bucket explicitly in metadata, and keeps the path
-- available to the application validator until the native client is migrated.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Safe parsers for the legacy Android storage convention.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.legacy_android_pod_driver_id_from_storage_name(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_segment text;
BEGIN
  v_segment := split_part(coalesce(p_name, ''), '/', 1);
  IF v_segment !~* '^driver-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN substring(v_segment FROM 8)::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.legacy_android_pod_job_id_from_storage_name(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_segment text;
BEGIN
  v_segment := split_part(coalesce(p_name, ''), '/', 2);
  IF v_segment = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_segment::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.legacy_android_pod_driver_id_from_storage_name(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legacy_android_pod_job_id_from_storage_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.legacy_android_pod_driver_id_from_storage_name(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.legacy_android_pod_job_id_from_storage_name(text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Permit only the assigned authenticated Android driver to use pod-docs.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS pod_docs_insert_android_assigned_driver_v2 ON storage.objects;
DROP POLICY IF EXISTS pod_docs_select_android_relationship_v2 ON storage.objects;

CREATE POLICY pod_docs_insert_android_assigned_driver_v2
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pod-docs'
  AND public.legacy_android_pod_driver_id_from_storage_name(name) IS NOT NULL
  AND public.legacy_android_pod_job_id_from_storage_name(name) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.drivers d ON d.id = j.assigned_driver_id
    WHERE j.id = public.legacy_android_pod_job_id_from_storage_name(name)
      AND d.id = public.legacy_android_pod_driver_id_from_storage_name(name)
      AND d.user_id = auth.uid()
      AND coalesce(d.app_access, true) = true
      AND coalesce(d.is_active, true) = true
      AND lower(coalesce(d.status::text, 'active')) = 'active'
  )
);

CREATE POLICY pod_docs_select_android_relationship_v2
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pod-docs'
  AND public.legacy_android_pod_job_id_from_storage_name(name) IS NOT NULL
  AND (
    public.can_view_job_pod(public.legacy_android_pod_job_id_from_storage_name(name))
    OR EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.drivers d ON d.id = j.assigned_driver_id
      WHERE j.id = public.legacy_android_pod_job_id_from_storage_name(name)
        AND d.id = public.legacy_android_pod_driver_id_from_storage_name(name)
        AND d.user_id = auth.uid()
        AND coalesce(d.app_access, true) = true
        AND coalesce(d.is_active, true) = true
        AND lower(coalesce(d.status::text, 'active')) = 'active'
    )
  )
);

-- -----------------------------------------------------------------------------
-- 3. Canonical POD validation recognises only explicitly-audited Android legacy
--    records in pod-docs; all normal records remain constrained to pod-photos.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_job_pod_valid(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.proof_of_delivery p
    WHERE p.job_id = p_job_id
      AND nullif(btrim(coalesce(p.received_by, '')), '') IS NOT NULL
      AND nullif(btrim(coalesce(p.signature_url, '')), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM storage.objects so
        WHERE so.name = p.signature_url
          AND so.bucket_id = CASE
            WHEN p.completion_source = 'driver_native'
             AND p.metadata ->> 'storage_bucket' = 'pod-docs'
            THEN 'pod-docs'
            ELSE 'pod-photos'
          END
      )
      AND (
        EXISTS (
          SELECT 1
          FROM unnest(coalesce(p.photo_urls, '{}'::text[])) AS photo_path
          JOIN storage.objects so
            ON so.name = photo_path
           AND so.bucket_id = CASE
             WHEN p.completion_source = 'driver_native'
              AND p.metadata ->> 'storage_bucket' = 'pod-docs'
             THEN 'pod-docs'
             ELSE 'pod-photos'
           END
          WHERE nullif(btrim(photo_path), '') IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(p.document_urls, '{}'::text[])) AS document_path
          JOIN storage.objects so
            ON so.name = document_path
           AND so.bucket_id = CASE
             WHEN p.completion_source = 'driver_native'
              AND p.metadata ->> 'storage_bucket' = 'pod-docs'
             THEN 'pod-docs'
             ELSE 'pod-photos'
           END
          WHERE nullif(btrim(document_path), '') IS NOT NULL
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. Native Android status RPC: align lifecycle and materialise structured POD
--    before the Delivered write so the DB trigger can enforce the invariant.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_update_job_status_atomic(
  p_driver_id uuid,
  p_job_id uuid,
  p_next_status text,
  p_collection_photo_url text DEFAULT NULL::text,
  p_driver_notes text DEFAULT NULL::text,
  p_delivery_photos jsonb DEFAULT NULL::jsonb,
  p_delivery_signature_data text DEFAULT NULL::text,
  p_client_signature_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_driver public.drivers%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_current_status text;
  v_next_status text := lower(btrim(coalesce(p_next_status, '')));
  v_expected_next text;
  v_timestamp_column text;
  v_tracking_event_type text;
  v_updated public.jobs%ROWTYPE;
  v_recipient text;
  v_evidence_path text;
  v_executing_company_id uuid;
  v_evidence_linked boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_driver_id IS NULL OR p_job_id IS NULL THEN
    RAISE EXCEPTION 'Driver id and job id are required.' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_driver
  FROM public.drivers d
  WHERE d.id = p_driver_id
    AND d.user_id = v_actor
    AND coalesce(d.app_access, true) = true
    AND coalesce(d.is_active, true) = true
    AND lower(coalesce(d.status::text, 'active')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver profile is not active for this account.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_job
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.assigned_driver_id IS DISTINCT FROM p_driver_id THEN
    RAISE EXCEPTION 'Status update could not be applied for this assignment.' USING ERRCODE = '42501';
  END IF;

  IF coalesce(v_job.awarded_carrier_company_id, v_job.assigned_company_id) IS NOT NULL
     AND coalesce(v_job.awarded_carrier_company_id, v_job.assigned_company_id) IS DISTINCT FROM v_driver.company_id THEN
    RAISE EXCEPTION 'Driver company does not match this assignment.' USING ERRCODE = '42501';
  END IF;

  v_current_status := lower(coalesce(
    nullif(v_job.current_status, ''),
    nullif(v_job.status, ''),
    'allocated'
  ));

  IF v_next_status = v_current_status THEN
    RETURN jsonb_build_object(
      'ok', true,
      'job_id', v_job.id,
      'status', v_job.status,
      'current_status', v_job.current_status,
      'assigned_driver_id', v_job.assigned_driver_id
    );
  END IF;

  v_expected_next := CASE v_current_status
    WHEN 'awarded' THEN 'on_my_way'
    WHEN 'assigned' THEN 'on_my_way'
    WHEN 'accepted' THEN 'on_my_way'
    WHEN 'allocated' THEN 'on_my_way'
    WHEN 'on_my_way' THEN 'on_site_pickup'
    WHEN 'on_site_pickup' THEN 'loaded'
    WHEN 'loaded' THEN 'in_transit'
    WHEN 'collected' THEN 'in_transit'
    WHEN 'in_transit' THEN 'on_site_delivery'
    WHEN 'on_site_delivery' THEN 'delivered'
    WHEN 'delivered' THEN 'completed'
    ELSE NULL
  END;

  IF v_expected_next IS NULL OR v_next_status <> v_expected_next THEN
    RAISE EXCEPTION 'Invalid driver status transition: % -> %', v_current_status, v_next_status
      USING ERRCODE = '23514';
  END IF;

  -- Android currently captures a signed POD document/photo and recipient name
  -- before asking to transition to Delivered. Convert that evidence into the
  -- structured canonical POD record first, then let the normal DB trigger decide.
  IF v_next_status = 'delivered' THEN
    v_recipient := nullif(btrim(coalesce(v_job.client_signature_name, '')), '');
    v_evidence_path := nullif(btrim(coalesce(
      v_job.delivery_signature_data ->> 'evidence_path',
      v_job.delivery_signature_data ->> 'storage_path',
      ''
    )), '');

    IF v_recipient IS NULL THEN
      RAISE EXCEPTION 'POD incomplete: recipient name is required before delivery completion.'
        USING ERRCODE = '23514';
    END IF;

    IF v_evidence_path IS NULL THEN
      RAISE EXCEPTION 'POD incomplete: signed POD evidence is required before delivery completion.'
        USING ERRCODE = '23514';
    END IF;

    IF public.legacy_android_pod_driver_id_from_storage_name(v_evidence_path) IS DISTINCT FROM p_driver_id
       OR public.legacy_android_pod_job_id_from_storage_name(v_evidence_path) IS DISTINCT FROM p_job_id
    THEN
      RAISE EXCEPTION 'POD evidence path does not belong to this driver assignment.'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM storage.objects so
      WHERE so.bucket_id = 'pod-docs'
        AND so.name = v_evidence_path
    ) THEN
      RAISE EXCEPTION 'POD incomplete: signed POD evidence is missing from storage.'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(v_job.delivery_photos) = 'array' THEN
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_job.delivery_photos) value
        WHERE value = v_evidence_path
      ) INTO v_evidence_linked;
    END IF;

    IF NOT v_evidence_linked AND jsonb_typeof(v_job.pod_photos) = 'array' THEN
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_job.pod_photos) value
        WHERE value = v_evidence_path
      ) INTO v_evidence_linked;
    END IF;

    IF NOT v_evidence_linked THEN
      RAISE EXCEPTION 'POD evidence is not linked to this job.'
        USING ERRCODE = '23514';
    END IF;

    v_executing_company_id := coalesce(
      v_job.awarded_carrier_company_id,
      v_job.assigned_company_id,
      v_driver.company_id,
      v_job.company_id
    );

    INSERT INTO public.proof_of_delivery (
      job_id,
      delivered_on,
      received_by,
      delivery_status,
      delivery_notes,
      signature_url,
      photo_urls,
      created_by,
      company_id,
      assigned_driver_id,
      on_behalf_of_driver_id,
      completed_by_user_id,
      completed_by_role,
      completion_source,
      completion_reason,
      document_urls,
      completed_at,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      p_job_id,
      current_date,
      v_recipient,
      'Completed Delivery',
      v_job.delivery_notes,
      v_evidence_path,
      '{}'::text[],
      v_actor,
      v_executing_company_id,
      p_driver_id,
      NULL,
      v_actor,
      'driver',
      'driver_native',
      NULL,
      ARRAY[v_evidence_path]::text[],
      now(),
      jsonb_build_object(
        'storage_bucket', 'pod-docs',
        'evidence_model', 'combined_signed_evidence',
        'compatibility_mode', 'android_native_legacy',
        'migration_target', 'pod-photos'
      ),
      now(),
      now()
    )
    ON CONFLICT (job_id) DO UPDATE
    SET received_by = EXCLUDED.received_by,
        delivery_status = EXCLUDED.delivery_status,
        delivery_notes = EXCLUDED.delivery_notes,
        signature_url = EXCLUDED.signature_url,
        photo_urls = EXCLUDED.photo_urls,
        company_id = EXCLUDED.company_id,
        assigned_driver_id = EXCLUDED.assigned_driver_id,
        on_behalf_of_driver_id = EXCLUDED.on_behalf_of_driver_id,
        completed_by_user_id = EXCLUDED.completed_by_user_id,
        completed_by_role = EXCLUDED.completed_by_role,
        completion_source = EXCLUDED.completion_source,
        completion_reason = EXCLUDED.completion_reason,
        document_urls = EXCLUDED.document_urls,
        completed_at = EXCLUDED.completed_at,
        metadata = EXCLUDED.metadata,
        updated_at = now();

    IF NOT public.is_job_pod_valid(p_job_id) THEN
      RAISE EXCEPTION 'POD incomplete: structured Android POD validation failed.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  v_timestamp_column := CASE v_next_status
    WHEN 'on_my_way' THEN 'on_my_way_at'
    WHEN 'on_site_pickup' THEN 'on_site_pickup_at'
    WHEN 'loaded' THEN 'loaded_at'
    WHEN 'on_site_delivery' THEN 'on_site_delivery_at'
    WHEN 'delivered' THEN 'delivered_at'
    WHEN 'completed' THEN 'completed_at'
    ELSE NULL
  END;

  v_tracking_event_type := CASE v_next_status
    WHEN 'on_my_way' THEN 'on_my_way_to_pickup'
    WHEN 'on_site_pickup' THEN 'on_site_pickup'
    WHEN 'loaded' THEN 'loaded'
    WHEN 'in_transit' THEN 'in_transit'
    WHEN 'on_site_delivery' THEN 'on_site_delivery'
    WHEN 'delivered' THEN 'delivered'
    ELSE NULL
  END;

  UPDATE public.jobs j
  SET status = v_next_status,
      current_status = v_next_status,
      collection_photo_url = coalesce(nullif(p_collection_photo_url, ''), j.collection_photo_url),
      driver_notes = coalesce(nullif(p_driver_notes, ''), j.driver_notes),
      delivery_photos = coalesce(p_delivery_photos, j.delivery_photos),
      delivery_signature_data = coalesce(to_jsonb(nullif(p_delivery_signature_data, '')), j.delivery_signature_data),
      client_signature_name = coalesce(nullif(p_client_signature_name, ''), j.client_signature_name),
      pod_required = true,
      pod_generated = CASE WHEN v_next_status = 'delivered' THEN true ELSE j.pod_generated END,
      pod_generated_at = CASE
        WHEN v_next_status = 'delivered' AND j.pod_generated_at IS NULL THEN now()
        ELSE j.pod_generated_at
      END,
      on_my_way_at = CASE WHEN v_timestamp_column = 'on_my_way_at' AND j.on_my_way_at IS NULL THEN now() ELSE j.on_my_way_at END,
      on_site_pickup_at = CASE WHEN v_timestamp_column = 'on_site_pickup_at' AND j.on_site_pickup_at IS NULL THEN now() ELSE j.on_site_pickup_at END,
      loaded_at = CASE WHEN v_timestamp_column = 'loaded_at' AND j.loaded_at IS NULL THEN now() ELSE j.loaded_at END,
      on_site_delivery_at = CASE WHEN v_timestamp_column = 'on_site_delivery_at' AND j.on_site_delivery_at IS NULL THEN now() ELSE j.on_site_delivery_at END,
      delivered_at = CASE WHEN v_timestamp_column = 'delivered_at' AND j.delivered_at IS NULL THEN now() ELSE j.delivered_at END,
      completed_at = CASE WHEN v_timestamp_column = 'completed_at' AND j.completed_at IS NULL THEN now() ELSE j.completed_at END,
      status_history = coalesce(j.status_history, '[]'::jsonb)
        || jsonb_build_object(
          'status', v_next_status,
          'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'source', 'driver_native'
        ),
      updated_at = now()
  WHERE j.id = p_job_id
    AND j.assigned_driver_id = p_driver_id
  RETURNING *
  INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status update could not be applied for this assignment.' USING ERRCODE = '42501';
  END IF;

  IF v_tracking_event_type IS NOT NULL THEN
    INSERT INTO public.job_tracking_events (job_id, event_type, event_time, user_id, created_by, message, meta)
    VALUES (
      p_job_id,
      v_tracking_event_type,
      now(),
      v_actor,
      v_actor,
      format('Driver updated job status to %s.', v_next_status),
      jsonb_build_object('driver_id', p_driver_id, 'source', 'driver_native')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', v_updated.id,
    'status', v_updated.status,
    'current_status', v_updated.current_status,
    'assigned_driver_id', v_updated.assigned_driver_id,
    'assigned_company_id', v_updated.assigned_company_id,
    'awarded_carrier_company_id', v_updated.awarded_carrier_company_id
  );
END;
$$;

COMMENT ON FUNCTION public.legacy_android_pod_driver_id_from_storage_name(text) IS
  'Safely extracts driver UUID from pod-docs/driver-{driver_id}/{job_id}/... Android legacy paths.';
COMMENT ON FUNCTION public.legacy_android_pod_job_id_from_storage_name(text) IS
  'Safely extracts job UUID from pod-docs/driver-{driver_id}/{job_id}/... Android legacy paths.';

NOTIFY pgrst, 'reload schema';

COMMIT;
