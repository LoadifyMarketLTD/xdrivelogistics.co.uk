-- Driver Smart / Load Alerts foundation.
--
-- This is opt-in and privacy-preserving:
-- - exact job and driver coordinates are used only inside the database matcher;
-- - emitted notification payloads expose public outcodes, never exact coordinates;
-- - the same load can generate at most one alert per recipient;
-- - no direct-client write can target another driver's preferences.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Marketplace code on main already writes exchange_expires_at, but the legacy
-- exchange-load migration never created the column on the hosted database.
-- Keep it nullable so existing exchange rows preserve their current semantics;
-- newly published loads populate the explicit expiry timestamp.
alter table public.jobs
  add column if not exists exchange_expires_at timestamptz;

create table if not exists public.driver_load_alert_preferences (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  current_radius_enabled boolean not null default true,
  home_outcode_enabled boolean not null default false,
  home_outcode text,
  future_position_enabled boolean not null default true,
  radius_miles integer not null default 30,
  current_location_max_age_minutes integer not null default 120,
  require_vehicle_match boolean not null default true,
  minimum_budget_gbp numeric(12,2),
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  check (radius_miles between 5 and 300),
  check (current_location_max_age_minutes between 15 and 360),
  check (minimum_budget_gbp is null or minimum_budget_gbp >= 0),
  check (home_outcode is null or length(btrim(home_outcode)) between 2 and 8),
  check (not enabled or current_radius_enabled or home_outcode_enabled or future_position_enabled),
  check (not enabled or in_app_enabled or email_enabled or push_enabled)
);

create index if not exists idx_driver_load_alert_preferences_enabled
  on public.driver_load_alert_preferences(company_id, driver_id)
  where enabled = true;

alter table public.driver_load_alert_preferences enable row level security;

-- Preferences are personal to the authenticated Driver account. The API uses the
-- same ownership checks through its service-role boundary; RLS remains strict for
-- any direct authenticated-table access.
drop policy if exists driver_load_alert_preferences_select_own on public.driver_load_alert_preferences;
create policy driver_load_alert_preferences_select_own
  on public.driver_load_alert_preferences
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.drivers d
      where d.id = driver_load_alert_preferences.driver_id
        and d.user_id = auth.uid()
        and d.company_id = driver_load_alert_preferences.company_id
        and d.app_access = true
    )
  );

drop policy if exists driver_load_alert_preferences_insert_own on public.driver_load_alert_preferences;
create policy driver_load_alert_preferences_insert_own
  on public.driver_load_alert_preferences
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.drivers d
      where d.id = driver_load_alert_preferences.driver_id
        and d.user_id = auth.uid()
        and d.company_id = driver_load_alert_preferences.company_id
        and d.app_access = true
    )
  );

drop policy if exists driver_load_alert_preferences_update_own on public.driver_load_alert_preferences;
create policy driver_load_alert_preferences_update_own
  on public.driver_load_alert_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.drivers d
      where d.id = driver_load_alert_preferences.driver_id
        and d.user_id = auth.uid()
        and d.company_id = driver_load_alert_preferences.company_id
        and d.app_access = true
    )
  );

drop policy if exists driver_load_alert_preferences_delete_own on public.driver_load_alert_preferences;
create policy driver_load_alert_preferences_delete_own
  on public.driver_load_alert_preferences
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.driver_load_alert_preferences from public, anon;
grant select, insert, update, delete on table public.driver_load_alert_preferences to authenticated;
grant all on table public.driver_load_alert_preferences to service_role;

-- One alert per load/recipient, independent of retry attempts or later job edits.
create unique index if not exists uq_notification_events_load_alert_recipient
  on public.notification_events(entity_id, recipient_user_id)
  where event_type = 'load_alert' and recipient_user_id is not null;

create or replace function public.fn_load_alert_outcode(p_value text)
returns text
language sql
immutable
security invoker
as $$
  select nullif(
    substring(regexp_replace(upper(coalesce(p_value, '')), '[^A-Z0-9 ]', '', 'g') from '^\s*([A-Z]{1,2}[0-9][0-9A-Z]?)'),
    ''
  );
$$;

create or replace function public.fn_load_alert_vehicle_key(p_value text)
returns text
language sql
immutable
security invoker
as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p_value, '')), '[^a-z0-9]+', '_', 'g')), '');
$$;

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
      and j.exchange_visibility in ('exchange', 'direct')
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
      event_type,
      entity_type,
      entity_id,
      company_id,
      recipient_user_id,
      payload
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

revoke all on function public.fn_enqueue_driver_load_alerts_for_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_enqueue_driver_load_alerts_for_job(uuid, uuid) to service_role;

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
     or new.exchange_visibility not in ('exchange', 'direct') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.fn_enqueue_driver_load_alerts_for_job(new.id);
    return new;
  end if;

  if old.exchange_posted_at is distinct from new.exchange_posted_at
     or old.exchange_visibility is distinct from new.exchange_visibility
     or old.direct_invite_company_id is distinct from new.direct_invite_company_id
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

drop trigger if exists trg_notify_driver_load_alert_on_marketplace_change on public.jobs;
create trigger trg_notify_driver_load_alert_on_marketplace_change
  after insert or update on public.jobs
  for each row
  execute function public.fn_notify_driver_load_alert_on_marketplace_change();

-- New/changed preferences also evaluate currently open recent loads for only the
-- authenticated recipient. The event unique index keeps replay idempotent.
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
      and j.exchange_visibility in ('exchange', 'direct')
      and (j.exchange_expires_at is null or j.exchange_expires_at > now())
    order by j.exchange_posted_at desc
    limit 250
  loop
    v_total := v_total + public.fn_enqueue_driver_load_alerts_for_job(v_job.id, p_user_id);
  end loop;

  return v_total;
end;
$$;

revoke all on function public.fn_enqueue_driver_load_alerts_for_user(uuid) from public, anon, authenticated;
grant execute on function public.fn_enqueue_driver_load_alerts_for_user(uuid) to service_role;

comment on table public.driver_load_alert_preferences is
  'Opt-in Driver Smart Load Alert rules. Exact tracking coordinates remain server-side and are never emitted in alert payloads.';
comment on function public.fn_enqueue_driver_load_alerts_for_job(uuid, uuid) is
  'Matches one marketplace load against enabled Driver alert preferences and emits idempotent recipient-scoped load_alert events. Optional recipient restricts replay to one user.';

notify pgrst, 'reload schema';

commit;
