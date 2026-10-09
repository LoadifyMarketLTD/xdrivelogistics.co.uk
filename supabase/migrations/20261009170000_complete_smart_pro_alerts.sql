begin;

alter table public.jobs
  add column if not exists proximity_alerts_enabled boolean not null default false,
  add column if not exists pickup_alert_radius_miles numeric(6,2) not null default 1,
  add column if not exists delivery_alert_radius_miles numeric(6,2) not null default 1;

alter table public.jobs drop constraint if exists jobs_pickup_alert_radius_miles_check;
alter table public.jobs add constraint jobs_pickup_alert_radius_miles_check
  check (pickup_alert_radius_miles between 0.1 and 50);
alter table public.jobs drop constraint if exists jobs_delivery_alert_radius_miles_check;
alter table public.jobs add constraint jobs_delivery_alert_radius_miles_check
  check (delivery_alert_radius_miles between 0.1 and 50);

create unique index if not exists uq_notification_events_job_proximity_recipient
  on public.notification_events(event_type, entity_id, recipient_user_id)
  where event_type in ('pickup_proximity_alert','delivery_proximity_alert')
    and entity_type = 'job'
    and recipient_user_id is not null;

create or replace function public.fn_enqueue_driver_load_alerts_for_job(
  p_job_id uuid,
  p_recipient_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  with target_job as (
    select
      j.id,
      j.company_id,
      j.status,
      j.exchange_visibility,
      j.direct_invite_company_id,
      j.visibility_group_id,
      j.exchange_posted_at,
      j.exchange_expires_at,
      j.awarded_carrier_company_id,
      j.pickup_postcode,
      j.delivery_postcode,
      j.pickup_lat,
      j.pickup_lng,
      j.pickup_datetime,
      coalesce(j.requested_vehicle_type, j.vehicle_type) as requested_vehicle_type,
      j.requested_vehicle_label,
      j.budget_amount
    from public.jobs j
    where j.id = p_job_id
      and lower(coalesce(j.status, '')) in ('posted', 'quoted')
      and j.exchange_posted_at is not null
      and j.awarded_carrier_company_id is null
      and j.exchange_visibility in ('exchange', 'direct', 'private_group')
      and (j.exchange_expires_at is null or j.exchange_expires_at > now())
  ),
  candidates as (
    select
      p.*,
      d.company_id as driver_company_id,
      d.future_position,
      d.future_position_date,
      v.vehicle_type as canonical_vehicle_type,
      latest.location as current_location,
      latest.recorded_at as current_location_recorded_at,
      tj.id as job_id,
      tj.company_id as job_company_id,
      tj.exchange_visibility,
      tj.direct_invite_company_id,
      tj.visibility_group_id,
      tj.pickup_postcode,
      tj.delivery_postcode,
      tj.pickup_lat,
      tj.pickup_lng,
      tj.pickup_datetime,
      tj.requested_vehicle_type,
      tj.requested_vehicle_label,
      tj.budget_amount
    from target_job tj
    join public.driver_load_alert_preferences p
      on p.enabled = true
     and (p_recipient_user_id is null or p.user_id = p_recipient_user_id)
    join public.drivers d
      on d.id = p.driver_id
     and d.user_id = p.user_id
     and d.company_id = p.company_id
     and d.app_access = true
     and d.status = 'active'
    left join lateral (
      select coalesce(vh.vehicle_type, vh.type) as vehicle_type
      from public.vehicles vh
      where vh.assigned_driver_id = d.id
        and vh.company_id = d.company_id
        and vh.status = 'active'
      order by vh.updated_at desc nulls last, vh.id
      limit 1
    ) v on true
    left join lateral (
      select dl.location, dl.recorded_at
      from public.driver_locations dl
      where dl.driver_id = d.id
        and dl.location is not null
      order by dl.recorded_at desc
      limit 1
    ) latest on true
    where d.company_id <> tj.company_id
      and (
        tj.exchange_visibility = 'exchange'
        or (tj.exchange_visibility = 'direct' and tj.direct_invite_company_id = d.company_id)
        or (
          tj.exchange_visibility = 'private_group'
          and tj.visibility_group_id is not null
          and exists (
            select 1
            from public.network_group_members ngm
            join public.network_groups ng on ng.id = ngm.group_id
            where ngm.group_id = tj.visibility_group_id
              and ngm.company_id = d.company_id
              and ng.allow_load_visibility = true
          )
        )
      )
      and (p.minimum_budget_gbp is null or coalesce(tj.budget_amount, 0) >= p.minimum_budget_gbp)
      and (
        not p.require_vehicle_match
        or public.fn_load_alert_vehicle_key(tj.requested_vehicle_type) is null
        or public.fn_load_alert_vehicle_key(v.vehicle_type) = public.fn_load_alert_vehicle_key(tj.requested_vehicle_type)
      )
  ),
  matched as (
    select
      c.*,
      array_remove(array[
        case
          when c.current_radius_enabled
           and c.current_location is not null
           and c.current_location_recorded_at >= now() - make_interval(mins => c.current_location_max_age_minutes)
           and c.pickup_lat is not null
           and c.pickup_lng is not null
           and st_dwithin(
             c.current_location,
             st_setsrid(st_makepoint(c.pickup_lng, c.pickup_lat), 4326)::geography,
             c.radius_miles * 1609.344
           )
          then 'current_location'
        end,
        case
          when c.home_outcode_enabled
           and public.fn_load_alert_outcode(c.home_outcode) is not null
           and public.fn_load_alert_outcode(c.home_outcode) = public.fn_load_alert_outcode(c.pickup_postcode)
          then 'home_outcode'
        end,
        case
          when c.future_position_enabled
           and c.future_position_date is not null
           and c.future_position_date >= now() - interval '6 hours'
           and c.pickup_datetime is not null
           and abs(extract(epoch from (c.future_position_date - c.pickup_datetime))) <= 172800
           and public.fn_load_alert_outcode(c.future_position) is not null
           and public.fn_load_alert_outcode(c.future_position) = public.fn_load_alert_outcode(c.pickup_postcode)
          then 'future_position'
        end
      ], null) as match_reasons
    from candidates c
  ),
  inserted as (
    insert into public.notification_events (
      event_type, entity_type, entity_id, company_id, recipient_user_id, payload
    )
    select
      'load_alert',
      'job',
      m.job_id,
      m.driver_company_id,
      m.user_id,
      jsonb_build_object(
        'job_id', m.job_id,
        'pickup_outcode', public.fn_load_alert_outcode(m.pickup_postcode),
        'delivery_outcode', public.fn_load_alert_outcode(m.delivery_postcode),
        'pickup_datetime', m.pickup_datetime,
        'vehicle_type', coalesce(m.requested_vehicle_label, m.requested_vehicle_type),
        'budget_amount', m.budget_amount,
        'match_reasons', to_jsonb(m.match_reasons),
        'visibility', m.exchange_visibility,
        'in_app_enabled', m.in_app_enabled,
        'email_enabled', m.email_enabled,
        'push_enabled', m.push_enabled
      )
    from matched m
    where cardinality(m.match_reasons) > 0
    on conflict do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

create or replace function public.fn_notify_driver_load_alert_on_marketplace_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.exchange_posted_at is null
     or lower(coalesce(new.status, '')) not in ('posted', 'quoted')
     or new.awarded_carrier_company_id is not null
     or new.exchange_visibility not in ('exchange', 'direct', 'private_group') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.fn_enqueue_driver_load_alerts_for_job(new.id);
    return new;
  end if;

  if old.exchange_posted_at is distinct from new.exchange_posted_at
     or old.exchange_visibility is distinct from new.exchange_visibility
     or old.direct_invite_company_id is distinct from new.direct_invite_company_id
     or old.visibility_group_id is distinct from new.visibility_group_id
     or old.status is distinct from new.status
     or old.pickup_postcode is distinct from new.pickup_postcode
     or old.pickup_lat is distinct from new.pickup_lat
     or old.pickup_lng is distinct from new.pickup_lng
     or old.pickup_datetime is distinct from new.pickup_datetime
     or old.vehicle_type is distinct from new.vehicle_type
     or old.requested_vehicle_type is distinct from new.requested_vehicle_type
     or old.budget_amount is distinct from new.budget_amount then
    perform public.fn_enqueue_driver_load_alerts_for_job(new.id);
  end if;

  return new;
end;
$$;

create or replace function public.fn_enqueue_driver_load_alerts_for_user(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record;
  v_total integer := 0;
begin
  if p_user_id is null then return 0; end if;

  for v_job in
    select j.id
    from public.jobs j
    where lower(coalesce(j.status, '')) in ('posted', 'quoted')
      and j.exchange_posted_at is not null
      and j.exchange_posted_at >= now() - interval '72 hours'
      and j.awarded_carrier_company_id is null
      and j.exchange_visibility in ('exchange', 'direct', 'private_group')
      and (j.exchange_expires_at is null or j.exchange_expires_at > now())
    order by j.exchange_posted_at desc
    limit 250
  loop
    v_total := v_total + public.fn_enqueue_driver_load_alerts_for_job(v_job.id, p_user_id);
  end loop;

  return v_total;
end;
$$;

comment on column public.jobs.proximity_alerts_enabled is
  'When enabled, XDrive emits idempotent pickup/delivery proximity notifications from authorised live or telematics locations.';
comment on column public.jobs.pickup_alert_radius_miles is
  'Pickup proximity threshold in miles for Smart/Pro Alerts.';
comment on column public.jobs.delivery_alert_radius_miles is
  'Delivery proximity threshold in miles for Smart/Pro Alerts.';

notify pgrst, 'reload schema';
commit;
