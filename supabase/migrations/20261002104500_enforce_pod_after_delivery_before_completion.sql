BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Canonical XDrive execution sequence:
-- on_site_delivery -> delivered -> mandatory POD -> completed -> invoice.
-- Delivered no longer implies POD completion. POD is persisted separately by
-- the POD endpoint; the atomic lifecycle blocks completed until that evidence
-- is present on the canonical job.

-- Invoice creation is an explicit post-POD action. Remove the legacy trigger
-- that created Marketplace invoices automatically from job lifecycle updates.
DROP TRIGGER IF EXISTS trg_generate_invoice_on_job_completion ON public.jobs;

-- POD is a platform rule, not a per-job opt-out. Normalise existing jobs and
-- default future rows to mandatory digital POD.
UPDATE public.jobs
SET pod_required = true
WHERE pod_required IS DISTINCT FROM true;

ALTER TABLE public.jobs
  ALTER COLUMN pod_required SET DEFAULT true;

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
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_driver public.drivers%rowtype;
  v_job public.jobs%rowtype;
  v_current_status text;
  v_next_status text := lower(btrim(coalesce(p_next_status, '')));
  v_expected_next text;
  v_tracking_event_type text;
  v_updated public.jobs%rowtype;
  v_effective_collection_photo text;
  v_effective_delivery_photos jsonb;
  v_effective_signature jsonb;
  v_effective_recipient text;
  v_signature_evidence text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_driver_id IS NULL OR p_job_id IS NULL THEN
    RAISE EXCEPTION 'Driver id and job id are required.' USING ERRCODE = '22023';
  END IF;

  SELECT d.*
  INTO v_driver
  FROM public.drivers d
  JOIN public.profiles p
    ON p.user_id = d.user_id
  JOIN public.companies c
    ON c.id = d.company_id
  WHERE d.id = p_driver_id
    AND d.user_id = v_actor
    AND COALESCE(d.app_access, false) = true
    AND COALESCE(d.is_active, true) = true
    AND lower(COALESCE(d.status::text, 'inactive')) = 'active'
    AND COALESCE(p.status::text, '') = 'active'
    AND c.status::text = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      WHERE cm.user_id = v_actor
        AND cm.company_id = d.company_id
        AND cm.status::text = 'active'
    )
  FOR UPDATE OF d;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver profile is not approved and active for this account.'
      USING ERRCODE = '42501';
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
    RAISE EXCEPTION 'Status update could not be applied for this assignment.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_job.awarded_carrier_company_id, v_job.assigned_company_id) IS NOT NULL
     AND COALESCE(v_job.awarded_carrier_company_id, v_job.assigned_company_id)
         IS DISTINCT FROM v_driver.company_id THEN
    RAISE EXCEPTION 'Driver company does not match this assignment.'
      USING ERRCODE = '42501';
  END IF;

  v_current_status := lower(
    COALESCE(NULLIF(v_job.current_status, ''), NULLIF(v_job.status, ''), 'allocated')
  );
  v_current_status := CASE v_current_status
    WHEN 'assigned' THEN 'allocated'
    WHEN 'arrived_pickup' THEN 'on_site_pickup'
    WHEN 'collected' THEN 'loaded'
    WHEN 'on_route_delivery' THEN 'in_transit'
    WHEN 'on_my_way_to_delivery' THEN 'in_transit'
    WHEN 'arrived_delivery' THEN 'on_site_delivery'
    ELSE v_current_status
  END;

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
    WHEN 'allocated' THEN 'accepted'
    WHEN 'accepted' THEN 'on_my_way'
    WHEN 'on_my_way' THEN 'on_site_pickup'
    WHEN 'on_site_pickup' THEN 'loaded'
    WHEN 'loaded' THEN 'in_transit'
    WHEN 'in_transit' THEN 'on_site_delivery'
    WHEN 'on_site_delivery' THEN 'delivered'
    WHEN 'delivered' THEN 'completed'
    ELSE NULL
  END;

  IF v_expected_next IS NULL OR v_next_status <> v_expected_next THEN
    RAISE EXCEPTION 'Invalid driver status transition: % -> %. Expected %.',
      v_current_status, v_next_status, v_expected_next
      USING ERRCODE = '23514';
  END IF;

  v_effective_collection_photo :=
    COALESCE(NULLIF(btrim(p_collection_photo_url), ''), v_job.collection_photo_url);
  v_effective_delivery_photos :=
    COALESCE(p_delivery_photos, v_job.delivery_photos, '[]'::jsonb);
  v_effective_signature := COALESCE(
    v_job.delivery_signature_data,
    CASE
      WHEN NULLIF(btrim(p_delivery_signature_data), '') IS NULL THEN NULL
      ELSE to_jsonb(btrim(p_delivery_signature_data))
    END
  );
  v_effective_recipient :=
    COALESCE(NULLIF(btrim(p_client_signature_name), ''), v_job.client_signature_name);

  IF v_next_status = 'loaded' AND v_effective_collection_photo IS NULL THEN
    RAISE EXCEPTION 'A loading photo is required before marking the job loaded.'
      USING ERRCODE = '23514';
  END IF;

  IF v_next_status = 'completed' THEN
    IF jsonb_typeof(v_effective_delivery_photos) <> 'array'
       OR jsonb_array_length(v_effective_delivery_photos) = 0 THEN
      RAISE EXCEPTION 'At least one delivery photo is required.'
        USING ERRCODE = '23514';
    END IF;

    IF v_effective_signature IS NULL THEN
      RAISE EXCEPTION 'Recipient signature is required.' USING ERRCODE = '23514';
    END IF;

    IF v_effective_recipient IS NULL THEN
      RAISE EXCEPTION 'Recipient name is required.' USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(v_effective_signature) = 'object' THEN
      v_signature_evidence :=
        NULLIF(btrim(v_effective_signature ->> 'evidence_path'), '');

      IF v_signature_evidence IS NULL THEN
        RAISE EXCEPTION 'Recipient signature must reference POD evidence.'
          USING ERRCODE = '23514';
      END IF;

      IF NOT (
        COALESCE(v_job.pod_photos, '[]'::jsonb)
          @> jsonb_build_array(v_signature_evidence)
        OR v_effective_delivery_photos
          @> jsonb_build_array(v_signature_evidence)
      ) THEN
        RAISE EXCEPTION 'Recipient signature evidence does not belong to this job.'
          USING ERRCODE = '23514';
      END IF;

      IF NULLIF(btrim(v_effective_signature ->> 'recipient_name'), '')
         IS DISTINCT FROM v_effective_recipient THEN
        RAISE EXCEPTION
          'Recipient signature name does not match the confirmed recipient.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  v_tracking_event_type := CASE v_next_status
    WHEN 'accepted' THEN 'note'
    WHEN 'on_my_way' THEN 'on_my_way_to_pickup'
    WHEN 'on_site_pickup' THEN 'on_site_pickup'
    WHEN 'loaded' THEN 'loaded'
    WHEN 'in_transit' THEN 'on_my_way_to_delivery'
    WHEN 'on_site_delivery' THEN 'on_site_delivery'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'completed' THEN 'note'
    ELSE NULL
  END;

  UPDATE public.jobs j
  SET
    status = v_next_status,
    current_status = v_next_status,
    collection_photo_url = v_effective_collection_photo,
    driver_notes = COALESCE(NULLIF(btrim(p_driver_notes), ''), j.driver_notes),
    delivery_photos = v_effective_delivery_photos,
    delivery_signature_data = COALESCE(v_effective_signature, j.delivery_signature_data),
    client_signature_name = v_effective_recipient,
    pod_generated = j.pod_generated,
    pod_generated_at = j.pod_generated_at,
    on_my_way_at = CASE
      WHEN v_next_status = 'on_my_way' AND j.on_my_way_at IS NULL THEN now()
      ELSE j.on_my_way_at
    END,
    on_site_pickup_at = CASE
      WHEN v_next_status = 'on_site_pickup' AND j.on_site_pickup_at IS NULL THEN now()
      ELSE j.on_site_pickup_at
    END,
    loaded_at = CASE
      WHEN v_next_status = 'loaded' AND j.loaded_at IS NULL THEN now()
      ELSE j.loaded_at
    END,
    on_site_delivery_at = CASE
      WHEN v_next_status = 'on_site_delivery' AND j.on_site_delivery_at IS NULL THEN now()
      ELSE j.on_site_delivery_at
    END,
    delivered_at = CASE
      WHEN v_next_status = 'delivered' AND j.delivered_at IS NULL THEN now()
      ELSE j.delivered_at
    END,
    completed_at = CASE
      WHEN v_next_status = 'completed' AND j.completed_at IS NULL THEN now()
      ELSE j.completed_at
    END,
    status_history = COALESCE(j.status_history, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'status', v_next_status,
        'timestamp', to_char(
          now() at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        ),
        'source', 'driver_atomic_rpc',
        'actor_user_id', v_actor
      )),
    updated_at = now()
  WHERE j.id = p_job_id
    AND j.assigned_driver_id = p_driver_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status update could not be applied for this assignment.'
      USING ERRCODE = '42501';
  END IF;

  IF v_tracking_event_type IS NOT NULL THEN
    INSERT INTO public.job_tracking_events (
      job_id, event_type, event_time, user_id, created_by, message, meta
    )
    VALUES (
      p_job_id,
      v_tracking_event_type,
      now(),
      v_actor,
      v_actor,
      format('Driver updated job status to %s.', v_next_status),
      jsonb_build_object('driver_id', p_driver_id, 'source', 'driver_atomic_rpc')
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
$function$;

REVOKE ALL ON FUNCTION public.driver_update_job_status_atomic(
  uuid, uuid, text, text, text, jsonb, text, text
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.driver_update_job_status_atomic(
  uuid, uuid, text, text, text, jsonb, text, text
)
TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
