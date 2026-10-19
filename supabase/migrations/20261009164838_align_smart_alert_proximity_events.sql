begin;

create or replace function public.fn_notify_job_smart_proximity()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job record;
  v_location extensions.geography;
  v_distance_miles numeric;
  v_status text;
begin
  if new.job_id is null then
    return new;
  end if;

  select
    j.id,
    j.proximity_alerts_enabled,
    j.pickup_proximity_alert_enabled,
    j.delivery_proximity_alert_enabled,
    j.pickup_alert_radius_miles,
    j.delivery_alert_radius_miles,
    j.pickup_lat,
    j.pickup_lng,
    j.delivery_lat,
    j.delivery_lng,
    coalesce(j.current_status, j.status, '') as effective_status
  into v_job
  from public.jobs j
  where j.id = new.job_id;

  if v_job.id is null or coalesce(v_job.proximity_alerts_enabled, false) is not true then
    return new;
  end if;

  v_location := coalesce(
    new.location,
    case
      when new.lat is not null and new.lng is not null
      then st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography
      else null
    end
  );
  if v_location is null then
    return new;
  end if;

  v_status := lower(trim(v_job.effective_status));

  if coalesce(v_job.pickup_proximity_alert_enabled, true)
     and v_job.pickup_lat is not null
     and v_job.pickup_lng is not null
     and v_status in ('allocated','accepted','on_my_way','on_my_way_to_pickup') then
    v_distance_miles := st_distance(
      v_location,
      st_setsrid(st_makepoint(v_job.pickup_lng, v_job.pickup_lat), 4326)::geography
    ) / 1609.344;

    if v_distance_miles <= v_job.pickup_alert_radius_miles then
      perform public.fn_emit_job_operational_alert(
        new.job_id,
        'pickup_proximity_alert',
        'Driver is within ' || v_job.pickup_alert_radius_miles || ' mile(s) of pickup.',
        'pickup-proximity',
        jsonb_build_object(
          'radius_miles', v_job.pickup_alert_radius_miles,
          'distance_miles', round(v_distance_miles, 2),
          'source', coalesce(new.source, 'location')
        )
      );
    end if;
  end if;

  if coalesce(v_job.delivery_proximity_alert_enabled, true)
     and v_job.delivery_lat is not null
     and v_job.delivery_lng is not null
     and v_status in ('loaded','collected','in_transit','on_my_way_to_delivery','on_route_delivery') then
    v_distance_miles := st_distance(
      v_location,
      st_setsrid(st_makepoint(v_job.delivery_lng, v_job.delivery_lat), 4326)::geography
    ) / 1609.344;

    if v_distance_miles <= v_job.delivery_alert_radius_miles then
      perform public.fn_emit_job_operational_alert(
        new.job_id,
        'delivery_proximity_alert',
        'Driver is within ' || v_job.delivery_alert_radius_miles || ' mile(s) of delivery.',
        'delivery-proximity',
        jsonb_build_object(
          'radius_miles', v_job.delivery_alert_radius_miles,
          'distance_miles', round(v_distance_miles, 2),
          'source', coalesce(new.source, 'location')
        )
      );
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
commit;
