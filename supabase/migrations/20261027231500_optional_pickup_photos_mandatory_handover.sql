-- Pickup photos optional; collection handover mandatory; delivery POD photo and signature unchanged.
BEGIN;
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

  -- Pickup photography is optional; the recorded collection handover remains mandatory.

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
create or replace function public.fn_jobs_mvp_guardrails()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_allowed_next text[];
  v_carrier_company_id uuid;
  v_issues text[];
  v_delivery_photo_count integer := 0;
  v_pod_photo_count integer := 0;
  v_undo_entry jsonb;
  v_request_role text;
  v_is_driver_undo boolean := false;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_allowed_next := case lower(coalesce(old.status::text, ''))
      when 'draft' then array['posted', 'cancelled', 'disputed']
      when 'open' then array['posted', 'allocated', 'cancelled', 'disputed']
      when 'received' then array['posted', 'allocated', 'cancelled', 'disputed']
      when 'posted' then array['quoted', 'awarded', 'allocated', 'cancelled', 'disputed']
      when 'quoted' then array['posted', 'awarded', 'allocated', 'accepted', 'cancelled', 'disputed']
      when 'awarded' then array['allocated', 'on_my_way', 'cancelled', 'disputed']
      when 'allocated' then array['accepted', 'on_my_way', 'cancelled', 'disputed']
      when 'accepted' then array['on_my_way', 'cancelled', 'disputed']
      when 'on_my_way' then array['on_site_pickup', 'cancelled', 'disputed']
      when 'on_my_way_to_pickup' then array['on_site_pickup', 'cancelled', 'disputed']
      when 'arrived_pickup' then array['loaded', 'cancelled', 'disputed']
      when 'on_site_pickup' then array['loaded', 'cancelled', 'disputed']
      when 'loaded' then array['in_transit', 'cancelled', 'disputed']
      when 'collected' then array['in_transit', 'cancelled', 'disputed']
      when 'in_transit' then array['on_site_delivery', 'cancelled', 'disputed']
      when 'on_my_way_to_delivery' then array['on_site_delivery', 'cancelled', 'disputed']
      when 'arrived_delivery' then array['delivered', 'cancelled', 'disputed']
      when 'on_site_delivery' then array['delivered', 'cancelled', 'disputed']
      when 'delivered' then array['completed']
      when 'completed' then array[]::text[]
      when 'invoiced' then array['paid']
      when 'paid' then array[]::text[]
      when 'cancelled' then array[]::text[]
      when 'disputed' then array[]::text[]
      else array[]::text[]
    end;

    if jsonb_typeof(coalesce(new.status_history, '[]'::jsonb)) = 'array'
       and jsonb_array_length(coalesce(new.status_history, '[]'::jsonb)) > 0 then
      v_undo_entry := new.status_history -> (jsonb_array_length(new.status_history) - 1);
    end if;

    v_request_role := coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
    );

    v_is_driver_undo :=
      v_request_role = 'service_role'
      and old.assigned_driver_id is not null
      and coalesce(v_undo_entry ->> 'source', '') = 'driver_mobile_undo'
      and lower(coalesce(v_undo_entry ->> 'undone_from', '')) = lower(coalesce(old.status::text, ''))
      and exists (
        select 1
        from public.drivers d
        where d.id = old.assigned_driver_id
          and d.user_id::text = coalesce(v_undo_entry ->> 'actor_user_id', '')
      )
      and (
        (lower(coalesce(old.status::text, '')) = 'accepted' and lower(coalesce(new.status::text, '')) = 'allocated')
        or (lower(coalesce(old.status::text, '')) = 'on_my_way' and lower(coalesce(new.status::text, '')) = 'accepted')
        or (lower(coalesce(old.status::text, '')) = 'on_site_pickup' and lower(coalesce(new.status::text, '')) = 'on_my_way')
        or (lower(coalesce(old.status::text, '')) = 'loaded' and lower(coalesce(new.status::text, '')) = 'on_site_pickup')
        or (lower(coalesce(old.status::text, '')) = 'in_transit' and lower(coalesce(new.status::text, '')) = 'loaded')
        or (lower(coalesce(old.status::text, '')) = 'on_site_delivery' and lower(coalesce(new.status::text, '')) = 'in_transit')
      );

    if not (lower(coalesce(new.status::text, '')) = any (v_allowed_next))
       and not v_is_driver_undo then
      raise exception 'Invalid job status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    -- Collection photography is optional; do not block Loaded for missing photo.

    if lower(coalesce(new.status::text, '')) = 'delivered'
       and coalesce(new.pod_required, true) then
      if jsonb_typeof(coalesce(new.delivery_photos, '[]'::jsonb)) = 'array' then
        v_delivery_photo_count := jsonb_array_length(coalesce(new.delivery_photos, '[]'::jsonb));
      end if;
      if jsonb_typeof(coalesce(new.pod_photos, '[]'::jsonb)) = 'array' then
        v_pod_photo_count := jsonb_array_length(coalesce(new.pod_photos, '[]'::jsonb));
      end if;

      if v_delivery_photo_count + v_pod_photo_count < 1 then
        raise exception 'At least one delivery photo or POD document is required before delivery.'
          using errcode = '23514';
      end if;
    end if;
  end if;

  if new.exchange_visibility = 'exchange'
     and (tg_op = 'INSERT' or coalesce(old.exchange_visibility, '') <> 'exchange') then
    v_issues := public.company_compliance_issues(new.company_id, 'publish');
    if coalesce(array_length(v_issues, 1), 0) > 0 then
      raise exception 'Compliance blocked publish action: %', array_to_string(v_issues, ' ')
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if lower(coalesce(new.status::text, '')) in (
      'awarded', 'allocated', 'accepted', 'on_my_way', 'on_site_pickup', 'loaded',
      'in_transit', 'on_site_delivery', 'delivered', 'completed'
    ) then
      v_carrier_company_id := coalesce(new.awarded_carrier_company_id, new.assigned_company_id, new.company_id);
      v_issues := public.company_compliance_issues(v_carrier_company_id, 'execution');
      if coalesce(array_length(v_issues, 1), 0) > 0 then
        raise exception 'Compliance blocked execution action: %', array_to_string(v_issues, ' ')
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.fn_require_canonical_collection_evidence_before_loaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_photo_count integer := 0;
  v_handover_photos jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_old_status := lower(COALESCE(NULLIF(OLD.current_status::text,''), NULLIF(OLD.status::text,''), ''));
  v_new_status := lower(COALESCE(NULLIF(NEW.current_status::text,''), NULLIF(NEW.status::text,''), ''));

  IF v_new_status <> 'loaded' OR v_old_status = 'loaded' THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(COALESCE(NEW.pickup_photos, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Collection photo evidence must be stored as a canonical photo array.' USING ERRCODE = '23514';
  END IF;
  v_photo_count := jsonb_array_length(COALESCE(NEW.pickup_photos, '[]'::jsonb));
  -- Empty photo array is valid for a verified collection handover.
  IF v_photo_count > 10 THEN
    RAISE EXCEPTION 'No more than 10 collection photos may be linked to one handover.' USING ERRCODE = '23514';
  END IF;

  IF NEW.collection_handover IS NULL OR jsonb_typeof(NEW.collection_handover) <> 'object' THEN
    RAISE EXCEPTION 'A verified collection handover is required before marking the job loaded.' USING ERRCODE = '23514';
  END IF;
  v_handover_photos := COALESCE(NEW.collection_handover -> 'photoPaths', '[]'::jsonb);
  IF jsonb_typeof(v_handover_photos) <> 'array' THEN
    RAISE EXCEPTION 'Collection handover photoPaths must be an array.' USING ERRCODE = '23514';
  END IF;
  IF NOT COALESCE(NEW.pickup_photos, '[]'::jsonb) @> v_handover_photos THEN
    RAISE EXCEPTION 'Collection handover photo evidence does not match the canonical job evidence.' USING ERRCODE = '23514';
  END IF;

  -- Legacy consumers may still read collection_photo_url. Preserve it as a
  -- compatibility pointer only; pickup_photos remains the canonical evidence list.
  IF NULLIF(btrim(COALESCE(NEW.collection_photo_url,'')), '') IS NULL THEN
    NEW.collection_photo_url := NEW.pickup_photos ->> 0;
  END IF;

  RETURN NEW;
END;
$$;
COMMIT;
NOTIFY pgrst, 'reload schema';
