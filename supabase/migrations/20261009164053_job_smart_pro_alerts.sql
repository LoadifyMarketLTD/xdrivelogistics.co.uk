begin;

create table if not exists public.job_smart_alert_preferences (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  enabled boolean not null default true,
  pickup_proximity_enabled boolean not null default true,
  delivery_proximity_enabled boolean not null default true,
  pickup_radius_miles numeric(5,2) not null default 1,
  delivery_radius_miles numeric(5,2) not null default 1,
  on_site_pickup_enabled boolean not null default true,
  loaded_enabled boolean not null default true,
  on_site_delivery_enabled boolean not null default true,
  pod_submitted_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_radius_miles in (1,2,5,10)),
  check (delivery_radius_miles in (1,2,5,10)),
  check (not enabled or in_app_enabled or email_enabled or push_enabled)
);

create index if not exists idx_job_smart_alert_preferences_company
  on public.job_smart_alert_preferences(company_id, updated_at desc);

alter table public.job_smart_alert_preferences enable row level security;
revoke all on table public.job_smart_alert_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.job_smart_alert_preferences to service_role;

create or replace function public.fn_emit_job_smart_alert(
  p_job_id uuid,
  p_event_type text,
  p_message text,
  p_idempotency_suffix text,
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_push_enabled boolean,
  p_extra_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job record;
  v_inserted integer := 0;
begin
  select j.id, j.company_id, j.pickup_postcode, j.delivery_postcode, j.current_status, j.status
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
      event_type, entity_type, entity_id, company_id, recipient_user_id, payload, idempotency_key
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
        'in_app_enabled', p_in_app_enabled,
        'email_enabled', p_email_enabled,
        'push_enabled', p_push_enabled
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

revoke all on function public.fn_emit_job_smart_alert(uuid,text,text,text,boolean,boolean,boolean,jsonb)
  from public, anon, authenticated;
grant execute on function public.fn_emit_job_smart_alert(uuid,text,text,text,boolean,boolean,boolean,jsonb)
  to service_role;

create or replace function public.fn_job_smart_alert_on_location()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_pref public.job_smart_alert_preferences%rowtype;
  v_job record;
  v_location extensions.geography;
  v_status text;
  v_distance_miles numeric;
begin
  if new.job_id is null then return new; end if;

  select * into v_pref from public.job_smart_alert_preferences p where p.job_id = new.job_id and p.enabled = true;
  if v_pref.job_id is null then return new; end if;

  select j.id,j.pickup_lat,j.pickup_lng,j.delivery_lat,j.delivery_lng,coalesce(j.current_status,j.status,'') as effective_status
  into v_job from public.jobs j where j.id = new.job_id;
  if v_job.id is null then return new; end if;

  v_location := coalesce(new.location, case when new.lat is not null and new.lng is not null then st_setsrid(st_makepoint(new.lng,new.lat),4326)::geography else null end);
  if v_location is null then return new; end if;
  v_status := lower(trim(v_job.effective_status));

  if v_pref.pickup_proximity_enabled
     and v_job.pickup_lat is not null and v_job.pickup_lng is not null
     and v_status in ('allocated','accepted','on_my_way','on_my_way_to_pickup') then
    v_distance_miles := st_distance(v_location,st_setsrid(st_makepoint(v_job.pickup_lng,v_job.pickup_lat),4326)::geography)/1609.344;
    if v_distance_miles <= v_pref.pickup_radius_miles then
      perform public.fn_emit_job_smart_alert(new.job_id,'job_pickup_proximity_alert','Driver is within '||v_pref.pickup_radius_miles||' mile(s) of pickup.','pickup-proximity',v_pref.in_app_enabled,v_pref.email_enabled,v_pref.push_enabled,jsonb_build_object('radius_miles',v_pref.pickup_radius_miles,'distance_miles',round(v_distance_miles,2),'source',coalesce(new.source,'location')));
    end if;
  end if;

  if v_pref.delivery_proximity_enabled
     and v_job.delivery_lat is not null and v_job.delivery_lng is not null
     and v_status in ('loaded','collected','in_transit','on_my_way_to_delivery','on_route_delivery') then
    v_distance_miles := st_distance(v_location,st_setsrid(st_makepoint(v_job.delivery_lng,v_job.delivery_lat),4326)::geography)/1609.344;
    if v_distance_miles <= v_pref.delivery_radius_miles then
      perform public.fn_emit_job_smart_alert(new.job_id,'job_delivery_proximity_alert','Driver is within '||v_pref.delivery_radius_miles||' mile(s) of delivery.','delivery-proximity',v_pref.in_app_enabled,v_pref.email_enabled,v_pref.push_enabled,jsonb_build_object('radius_miles',v_pref.delivery_radius_miles,'distance_miles',round(v_distance_miles,2),'source',coalesce(new.source,'location')));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_job_smart_alert_on_location on public.driver_locations;
create trigger trg_job_smart_alert_on_location after insert on public.driver_locations for each row execute function public.fn_job_smart_alert_on_location();

create or replace function public.fn_job_smart_alert_on_job_update()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_pref public.job_smart_alert_preferences%rowtype;
  v_old_status text;
  v_new_status text;
begin
  select * into v_pref from public.job_smart_alert_preferences p where p.job_id = new.id and p.enabled = true;
  if v_pref.job_id is null then return new; end if;

  v_old_status := lower(trim(coalesce(old.current_status, old.status, '')));
  v_new_status := lower(trim(coalesce(new.current_status, new.status, '')));

  if v_new_status is distinct from v_old_status then
    if v_new_status in ('on_site_pickup','arrived_pickup') and v_pref.on_site_pickup_enabled then
      perform public.fn_emit_job_smart_alert(new.id,'job_on_site_pickup_alert','Driver is on site at pickup.','on-site-pickup',v_pref.in_app_enabled,v_pref.email_enabled,v_pref.push_enabled,jsonb_build_object('status',v_new_status));
    elsif v_new_status in ('loaded','collected') and v_pref.loaded_enabled then
      perform public.fn_emit_job_smart_alert(new.id,'job_loaded_alert','Load has been collected and marked loaded.','loaded',v_pref.in_app_enabled,v_pref.email_enabled,v_pref.push_enabled,jsonb_build_object('status',v_new_status));
    elsif v_new_status in ('on_site_delivery','arrived_delivery') and v_pref.on_site_delivery_enabled then
      perform public.fn_emit_job_smart_alert(new.id,'job_on_site_delivery_alert','Driver is on site at delivery.','on-site-delivery',v_pref.in_app_enabled,v_pref.email_enabled,v_pref.push_enabled,jsonb_build_object('status',v_new_status));
    end if;
  end if;

  if coalesce(old.pod_generated,false)=false and coalesce(new.pod_generated,false)=true and v_pref.pod_submitted_enabled then
    perform public.fn_emit_job_smart_alert(new.id,'job_pod_submitted_alert','POD has been submitted for this booking.','pod-submitted',v_pref.in_app_enabled,v_pref.email_enabled,v_pref.push_enabled,jsonb_build_object('pod_generated_at',new.pod_generated_at));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_smart_alert_on_job_update on public.jobs;
create trigger trg_job_smart_alert_on_job_update after update of status,current_status,pod_generated,pod_generated_at on public.jobs for each row execute function public.fn_job_smart_alert_on_job_update();

notify pgrst, 'reload schema';
commit;
