begin;

-- Consolidate Smart / Pro Alerts on the existing booking record. The earlier
-- marketplace/load-alert foundation already owns proximity settings on jobs;
-- these columns complete milestone and delivery-channel preferences.
alter table public.jobs
  add column if not exists pickup_proximity_alert_enabled boolean not null default true,
  add column if not exists delivery_proximity_alert_enabled boolean not null default true,
  add column if not exists alert_on_site_pickup_enabled boolean not null default true,
  add column if not exists alert_loaded_enabled boolean not null default true,
  add column if not exists alert_on_site_delivery_enabled boolean not null default true,
  add column if not exists alert_pod_submitted_enabled boolean not null default true,
  add column if not exists smart_alert_in_app_enabled boolean not null default true,
  add column if not exists smart_alert_email_enabled boolean not null default false,
  add column if not exists smart_alert_push_enabled boolean not null default false,
  add column if not exists smart_alerts_updated_at timestamptz;

-- Remove the temporary parallel preference-store implementation. Smart Alerts
-- remain booking-owned, using the existing jobs proximity fields plus the
-- milestone/channel columns above.
drop trigger if exists trg_job_smart_alert_on_location on public.driver_locations;
drop function if exists public.fn_job_smart_alert_on_location();
drop trigger if exists trg_job_smart_alert_on_job_update on public.jobs;
drop function if exists public.fn_job_smart_alert_on_job_update();
drop function if exists public.fn_emit_job_smart_alert(uuid,text,text,text,boolean,boolean,boolean,jsonb);
drop table if exists public.job_smart_alert_preferences cascade;

create or replace function public.fn_emit_job_operational_alert(
  p_job_id uuid,
  p_event_type text,
  p_message text,
  p_idempotency_suffix text,
  p_extra_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record;
  v_inserted integer := 0;
begin
  select
    j.id,
    j.company_id,
    j.pickup_postcode,
    j.delivery_postcode,
    j.smart_alert_in_app_enabled,
    j.smart_alert_email_enabled,
    j.smart_alert_push_enabled
  into v_job
  from public.jobs j
  where j.id = p_job_id;

  if v_job.id is null or v_job.company_id is null then
    return 0;
  end if;

  with recipients as (
    select distinct cm.user_id
    from public.company_memberships cm
    where cm.company_id = v_job.company_id
      and cm.status = 'active'
      and cm.user_id is not null
  ),
  inserted as (
    insert into public.notification_events (
      event_type,
      entity_type,
      entity_id,
      company_id,
      recipient_user_id,
      payload,
      idempotency_key
    )
    select
      p_event_type,
      'job',
      v_job.id,
      v_job.company_id,
      r.user_id,
      jsonb_build_object(
        'job_id', v_job.id,
        'pickup_outcode', public.fn_load_alert_outcode(v_job.pickup_postcode),
        'delivery_outcode', public.fn_load_alert_outcode(v_job.delivery_postcode),
        'message', p_message,
        'in_app_enabled', v_job.smart_alert_in_app_enabled,
        'email_enabled', v_job.smart_alert_email_enabled,
        'push_enabled', v_job.smart_alert_push_enabled
      ) || coalesce(p_extra_payload, '{}'::jsonb),
      'smart-job:' || v_job.id::text || ':' || p_idempotency_suffix || ':' || r.user_id::text
    from recipients r
    on conflict do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

revoke all on function public.fn_emit_job_operational_alert(uuid,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.fn_emit_job_operational_alert(uuid,text,text,text,jsonb)
  to service_role;

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

drop trigger if exists trg_notify_job_smart_proximity on public.driver_locations;
create trigger trg_notify_job_smart_proximity
  after insert on public.driver_locations
  for each row
  execute function public.fn_notify_job_smart_proximity();

create or replace function public.fn_notify_job_smart_milestones()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  if coalesce(new.proximity_alerts_enabled, false) is not true then
    return new;
  end if;

  v_old_status := lower(trim(coalesce(old.current_status, old.status, '')));
  v_new_status := lower(trim(coalesce(new.current_status, new.status, '')));

  if v_new_status is distinct from v_old_status then
    if v_new_status in ('on_site_pickup', 'arrived_pickup')
       and coalesce(new.alert_on_site_pickup_enabled, true) then
      perform public.fn_emit_job_operational_alert(
        new.id,
        'job_on_site_pickup_alert',
        'Driver is on site at pickup.',
        'on-site-pickup',
        jsonb_build_object('status', v_new_status)
      );
    elsif v_new_status in ('loaded', 'collected')
       and coalesce(new.alert_loaded_enabled, true) then
      perform public.fn_emit_job_operational_alert(
        new.id,
        'job_loaded_alert',
        'Load has been collected and marked loaded.',
        'loaded',
        jsonb_build_object('status', v_new_status)
      );
    elsif v_new_status in ('on_site_delivery', 'arrived_delivery')
       and coalesce(new.alert_on_site_delivery_enabled, true) then
      perform public.fn_emit_job_operational_alert(
        new.id,
        'job_on_site_delivery_alert',
        'Driver is on site at delivery.',
        'on-site-delivery',
        jsonb_build_object('status', v_new_status)
      );
    end if;
  end if;

  if coalesce(old.pod_generated, false) = false
     and coalesce(new.pod_generated, false) = true
     and coalesce(new.alert_pod_submitted_enabled, true) then
    perform public.fn_emit_job_operational_alert(
      new.id,
      'job_pod_submitted_alert',
      'POD has been submitted for this booking.',
      'pod-submitted',
      jsonb_build_object('pod_generated_at', new.pod_generated_at)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_job_smart_milestones on public.jobs;
create trigger trg_notify_job_smart_milestones
  after update of status, current_status, pod_generated, pod_generated_at on public.jobs
  for each row
  execute function public.fn_notify_job_smart_milestones();

comment on column public.jobs.proximity_alerts_enabled is
  'Master booking-level Smart / Pro Alert switch for proximity and milestone notifications.';
comment on column public.jobs.smart_alert_email_enabled is
  'Allow Smart / Pro Alert notification events to use email delivery when the recipient notification preference also permits it.';
comment on column public.jobs.smart_alert_push_enabled is
  'Allow Smart / Pro Alert notification events to use push delivery.';

notify pgrst, 'reload schema';
commit;
