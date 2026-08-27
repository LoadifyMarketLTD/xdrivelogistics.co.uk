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
    when 'accepted' then 'allocated'
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
    when 'awarded' then 'on_my_way'
    when 'allocated' then 'on_my_way'
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
