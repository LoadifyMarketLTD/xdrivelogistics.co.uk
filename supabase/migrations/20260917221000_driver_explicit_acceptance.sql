-- Explicit Driver acceptance stage: allocated -> accepted -> on_my_way.
-- Driver RPC is strict; general guard retains direct allocated -> on_my_way only for legacy writers.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

create or replace function public.driver_update_job_status_atomic(
  p_driver_id uuid,
  p_job_id uuid,
  p_next_status text,
  p_collection_photo_url text default null,
  p_driver_notes text default null,
  p_delivery_photos jsonb default null,
  p_delivery_signature_data text default null,
  p_client_signature_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
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
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_driver_id is null or p_job_id is null then
    raise exception 'Driver id and job id are required.' using errcode = '22023';
  end if;

  select * into v_driver
  from public.drivers d
  where d.id = p_driver_id
    and d.user_id = v_actor
    and coalesce(d.app_access, false) = true
    and coalesce(d.is_active, true) = true
    and lower(coalesce(d.status::text, 'inactive')) = 'active'
  for update;

  if not found then
    raise exception 'Driver profile is not approved and active for this account.' using errcode = '42501';
  end if;

  select * into v_job
  from public.jobs j
  where j.id = p_job_id
  for update;

  if not found then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.assigned_driver_id is distinct from p_driver_id then
    raise exception 'Status update could not be applied for this assignment.' using errcode = '42501';
  end if;

  if coalesce(v_job.awarded_carrier_company_id, v_job.assigned_company_id) is not null
     and coalesce(v_job.awarded_carrier_company_id, v_job.assigned_company_id) is distinct from v_driver.company_id then
    raise exception 'Driver company does not match this assignment.' using errcode = '42501';
  end if;

  v_current_status := lower(coalesce(nullif(v_job.current_status, ''), nullif(v_job.status, ''), 'allocated'));
  v_current_status := case v_current_status
    when 'assigned' then 'allocated'
    when 'arrived_pickup' then 'on_site_pickup'
    when 'collected' then 'loaded'
    when 'on_route_delivery' then 'in_transit'
    when 'on_my_way_to_delivery' then 'in_transit'
    when 'arrived_delivery' then 'on_site_delivery'
    else v_current_status
  end;

  if v_next_status = v_current_status then
    return jsonb_build_object(
      'ok', true,
      'job_id', v_job.id,
      'status', v_job.status,
      'current_status', v_job.current_status,
      'assigned_driver_id', v_job.assigned_driver_id
    );
  end if;

  v_expected_next := case v_current_status
    when 'allocated' then 'accepted'
    when 'accepted' then 'on_my_way'
    when 'on_my_way' then 'on_site_pickup'
    when 'on_site_pickup' then 'loaded'
    when 'loaded' then 'in_transit'
    when 'in_transit' then 'on_site_delivery'
    when 'on_site_delivery' then 'delivered'
    when 'delivered' then 'completed'
    else null
  end;

  if v_expected_next is null or v_next_status <> v_expected_next then
    raise exception 'Invalid driver status transition: % -> %. Expected %.', v_current_status, v_next_status, v_expected_next
      using errcode = '23514';
  end if;

  v_effective_collection_photo := coalesce(nullif(btrim(p_collection_photo_url), ''), v_job.collection_photo_url);
  v_effective_delivery_photos := coalesce(p_delivery_photos, v_job.delivery_photos, '[]'::jsonb);
  v_effective_signature := coalesce(
    v_job.delivery_signature_data,
    case
      when nullif(btrim(p_delivery_signature_data), '') is null then null
      else to_jsonb(btrim(p_delivery_signature_data))
    end
  );
  v_effective_recipient := coalesce(nullif(btrim(p_client_signature_name), ''), v_job.client_signature_name);

  if v_next_status = 'loaded' and v_effective_collection_photo is null then
    raise exception 'A loading photo is required before marking the job loaded.' using errcode = '23514';
  end if;

  if v_next_status = 'delivered' and coalesce(v_job.pod_required, true) then
    if jsonb_typeof(v_effective_delivery_photos) <> 'array' or jsonb_array_length(v_effective_delivery_photos) = 0 then
      raise exception 'At least one delivery photo is required.' using errcode = '23514';
    end if;
    if v_effective_signature is null then
      raise exception 'Recipient signature is required.' using errcode = '23514';
    end if;
    if v_effective_recipient is null then
      raise exception 'Recipient name is required.' using errcode = '23514';
    end if;

    if jsonb_typeof(v_effective_signature) = 'object' then
      v_signature_evidence := nullif(btrim(v_effective_signature ->> 'evidence_path'), '');
      if v_signature_evidence is null then
        raise exception 'Recipient signature must reference POD evidence.' using errcode = '23514';
      end if;
      if not (
        coalesce(v_job.pod_photos, '[]'::jsonb) @> jsonb_build_array(v_signature_evidence)
        or v_effective_delivery_photos @> jsonb_build_array(v_signature_evidence)
      ) then
        raise exception 'Recipient signature evidence does not belong to this job.' using errcode = '23514';
      end if;
      if nullif(btrim(v_effective_signature ->> 'recipient_name'), '') is distinct from v_effective_recipient then
        raise exception 'Recipient signature name does not match the confirmed recipient.' using errcode = '23514';
      end if;
    end if;
  end if;

  v_tracking_event_type := case v_next_status
    when 'accepted' then 'note'
    when 'on_my_way' then 'on_my_way_to_pickup'
    when 'on_site_pickup' then 'on_site_pickup'
    when 'loaded' then 'loaded'
    when 'in_transit' then 'on_my_way_to_delivery'
    when 'on_site_delivery' then 'on_site_delivery'
    when 'delivered' then 'delivered'
    when 'completed' then 'note'
    else null
  end;

  update public.jobs j
  set status = v_next_status,
      current_status = v_next_status,
      collection_photo_url = v_effective_collection_photo,
      driver_notes = coalesce(nullif(btrim(p_driver_notes), ''), j.driver_notes),
      delivery_photos = v_effective_delivery_photos,
      delivery_signature_data = coalesce(v_effective_signature, j.delivery_signature_data),
      client_signature_name = v_effective_recipient,
      pod_generated = case when v_next_status = 'delivered' then true else j.pod_generated end,
      pod_generated_at = case when v_next_status = 'delivered' then coalesce(j.pod_generated_at, now()) else j.pod_generated_at end,
      on_my_way_at = case when v_next_status = 'on_my_way' and j.on_my_way_at is null then now() else j.on_my_way_at end,
      on_site_pickup_at = case when v_next_status = 'on_site_pickup' and j.on_site_pickup_at is null then now() else j.on_site_pickup_at end,
      loaded_at = case when v_next_status = 'loaded' and j.loaded_at is null then now() else j.loaded_at end,
      on_site_delivery_at = case when v_next_status = 'on_site_delivery' and j.on_site_delivery_at is null then now() else j.on_site_delivery_at end,
      delivered_at = case when v_next_status = 'delivered' and j.delivered_at is null then now() else j.delivered_at end,
      completed_at = case when v_next_status = 'completed' and j.completed_at is null then now() else j.completed_at end,
      status_history = coalesce(j.status_history, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'status', v_next_status,
          'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'source', 'driver_atomic_rpc',
          'actor_user_id', v_actor
        )),
      updated_at = now()
  where j.id = p_job_id
    and j.assigned_driver_id = p_driver_id
  returning * into v_updated;

  if not found then
    raise exception 'Status update could not be applied for this assignment.' using errcode = '42501';
  end if;

  if v_tracking_event_type is not null then
    insert into public.job_tracking_events (job_id, event_type, event_time, user_id, created_by, message, meta)
    values (
      p_job_id,
      v_tracking_event_type,
      now(),
      v_actor,
      v_actor,
      format('Driver updated job status to %s.', v_next_status),
      jsonb_build_object('driver_id', p_driver_id, 'source', 'driver_atomic_rpc')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'job_id', v_updated.id,
    'status', v_updated.status,
    'current_status', v_updated.current_status,
    'assigned_driver_id', v_updated.assigned_driver_id,
    'assigned_company_id', v_updated.assigned_company_id,
    'awarded_carrier_company_id', v_updated.awarded_carrier_company_id
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.fn_jobs_mvp_guardrails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed_next text[];
  v_carrier_company_id uuid;
  v_issues text[];
  v_delivery_photo_count integer := 0;
  v_pod_photo_count integer := 0;
  v_signature_text text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_allowed_next := CASE lower(COALESCE(OLD.status::text, ''))
      WHEN 'draft' THEN ARRAY['posted', 'cancelled', 'disputed']
      WHEN 'open' THEN ARRAY['posted', 'allocated', 'cancelled', 'disputed']
      WHEN 'received' THEN ARRAY['posted', 'allocated', 'cancelled', 'disputed']
      WHEN 'posted' THEN ARRAY['quoted', 'awarded', 'allocated', 'cancelled', 'disputed']
      WHEN 'quoted' THEN ARRAY['posted', 'awarded', 'allocated', 'cancelled', 'disputed']
      WHEN 'awarded' THEN ARRAY['allocated', 'on_my_way', 'cancelled', 'disputed']
      WHEN 'allocated' THEN ARRAY['accepted', 'on_my_way', 'cancelled', 'disputed']
      WHEN 'accepted' THEN ARRAY['on_my_way', 'cancelled', 'disputed']
      WHEN 'on_my_way' THEN ARRAY['on_site_pickup', 'cancelled', 'disputed']
      WHEN 'on_my_way_to_pickup' THEN ARRAY['on_site_pickup', 'cancelled', 'disputed']
      WHEN 'arrived_pickup' THEN ARRAY['loaded', 'cancelled', 'disputed']
      WHEN 'on_site_pickup' THEN ARRAY['loaded', 'cancelled', 'disputed']
      WHEN 'loaded' THEN ARRAY['in_transit', 'cancelled', 'disputed']
      WHEN 'collected' THEN ARRAY['in_transit', 'cancelled', 'disputed']
      WHEN 'in_transit' THEN ARRAY['on_site_delivery', 'cancelled', 'disputed']
      WHEN 'on_my_way_to_delivery' THEN ARRAY['on_site_delivery', 'cancelled', 'disputed']
      WHEN 'arrived_delivery' THEN ARRAY['delivered', 'cancelled', 'disputed']
      WHEN 'on_site_delivery' THEN ARRAY['delivered', 'cancelled', 'disputed']
      WHEN 'delivered' THEN ARRAY['completed']
      WHEN 'completed' THEN ARRAY[]::text[]
      WHEN 'invoiced' THEN ARRAY['paid']
      WHEN 'paid' THEN ARRAY[]::text[]
      WHEN 'cancelled' THEN ARRAY[]::text[]
      WHEN 'disputed' THEN ARRAY[]::text[]
      ELSE ARRAY[]::text[]
    END;

    IF NOT (lower(COALESCE(NEW.status::text, '')) = ANY (v_allowed_next)) THEN
      RAISE EXCEPTION 'Invalid job status transition: % -> %', OLD.status, NEW.status
        USING ERRCODE = '23514';
    END IF;

    IF lower(COALESCE(NEW.status::text, '')) = 'loaded'
       AND NULLIF(btrim(COALESCE(NEW.collection_photo_url, '')), '') IS NULL THEN
      RAISE EXCEPTION 'A loading photo is required before marking the job loaded.'
        USING ERRCODE = '23514';
    END IF;

    IF lower(COALESCE(NEW.status::text, '')) = 'delivered'
       AND COALESCE(NEW.pod_required, true) THEN
      IF jsonb_typeof(COALESCE(NEW.delivery_photos, '[]'::jsonb)) = 'array' THEN
        v_delivery_photo_count := jsonb_array_length(COALESCE(NEW.delivery_photos, '[]'::jsonb));
      END IF;
      IF jsonb_typeof(COALESCE(NEW.pod_photos, '[]'::jsonb)) = 'array' THEN
        v_pod_photo_count := jsonb_array_length(COALESCE(NEW.pod_photos, '[]'::jsonb));
      END IF;

      IF v_delivery_photo_count + v_pod_photo_count < 1 THEN
        RAISE EXCEPTION 'At least one delivery photo or POD document is required before delivery.'
          USING ERRCODE = '23514';
      END IF;

      IF NEW.delivery_signature_data IS NULL OR NEW.delivery_signature_data = 'null'::jsonb THEN
        RAISE EXCEPTION 'Recipient signature is required before delivery.' USING ERRCODE = '23514';
      END IF;
      IF jsonb_typeof(NEW.delivery_signature_data) = 'string' THEN
        v_signature_text := NEW.delivery_signature_data #>> '{}';
        IF NULLIF(btrim(COALESCE(v_signature_text, '')), '') IS NULL THEN
          RAISE EXCEPTION 'Recipient signature is required before delivery.' USING ERRCODE = '23514';
        END IF;
      END IF;
      IF NULLIF(btrim(COALESCE(NEW.client_signature_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Recipient name is required before delivery.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF NEW.exchange_visibility = 'exchange'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.exchange_visibility, '') <> 'exchange') THEN
    v_issues := public.company_compliance_issues(NEW.company_id, 'publish');
    IF COALESCE(array_length(v_issues, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Compliance blocked publish action: %', array_to_string(v_issues, ' ')
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    IF lower(COALESCE(NEW.status::text, '')) IN (
      'awarded', 'allocated', 'accepted', 'on_my_way', 'on_site_pickup', 'loaded',
      'in_transit', 'on_site_delivery', 'delivered', 'completed'
    ) THEN
      v_carrier_company_id := COALESCE(NEW.awarded_carrier_company_id, NEW.assigned_company_id, NEW.company_id);
      v_issues := public.company_compliance_issues(v_carrier_company_id, 'execution');
      IF COALESCE(array_length(v_issues, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Compliance blocked execution action: %', array_to_string(v_issues, ' ')
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_mvp_guardrails ON public.jobs;
CREATE TRIGGER trg_jobs_mvp_guardrails
BEFORE INSERT OR UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_jobs_mvp_guardrails();

COMMENT ON FUNCTION public.fn_jobs_mvp_guardrails() IS
  'PR357-compatible DB backstop preserving the current live XDrive execution transitions, POD evidence contract and publish/execution compliance boundaries.';



CREATE OR REPLACE FUNCTION public.fn_sync_legacy_job_status_into_current_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_execution_status text;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.current_status IS DISTINCT FROM OLD.current_status THEN
    RETURN NEW;
  END IF;

  v_status := lower(btrim(COALESCE(NEW.status::text, '')));

  -- Normalize only aliases already recognized by the approved Driver/workspace
  -- lifecycle. Unknown values and Finance-only aliases are never projected into
  -- current_status by this compatibility trigger.
  v_execution_status := CASE v_status
    WHEN 'assigned' THEN 'allocated'
    WHEN 'accepted' THEN 'accepted'
    WHEN 'on_my_way_to_pickup' THEN 'on_my_way'
    WHEN 'arrived_pickup' THEN 'on_site_pickup'
    WHEN 'collected' THEN 'loaded'
    WHEN 'on_route_delivery' THEN 'in_transit'
    WHEN 'on_my_way_to_delivery' THEN 'in_transit'
    WHEN 'arrived_delivery' THEN 'on_site_delivery'
    WHEN 'draft' THEN 'draft'
    WHEN 'open' THEN 'open'
    WHEN 'received' THEN 'received'
    WHEN 'posted' THEN 'posted'
    WHEN 'quoted' THEN 'quoted'
    WHEN 'awarded' THEN 'awarded'
    WHEN 'allocated' THEN 'allocated'
    WHEN 'on_my_way' THEN 'on_my_way'
    WHEN 'on_site_pickup' THEN 'on_site_pickup'
    WHEN 'loaded' THEN 'loaded'
    WHEN 'in_transit' THEN 'in_transit'
    WHEN 'on_site_delivery' THEN 'on_site_delivery'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'disputed' THEN 'disputed'
    WHEN 'driver_declined' THEN 'driver_declined'
    WHEN 'expired' THEN 'expired'
    ELSE NULL
  END;

  IF v_execution_status IS NOT NULL THEN
    NEW.current_status := v_execution_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_legacy_status_current_status_sync ON public.jobs;
CREATE TRIGGER trg_jobs_legacy_status_current_status_sync
BEFORE UPDATE OF status, current_status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_legacy_job_status_into_current_status();


COMMENT ON FUNCTION public.driver_update_job_status_atomic(uuid,uuid,text,text,text,jsonb,text,text) IS 'Driver execution lifecycle with explicit allocated -> accepted -> on_my_way acceptance stage.';
NOTIFY pgrst, 'reload schema';
COMMIT;
