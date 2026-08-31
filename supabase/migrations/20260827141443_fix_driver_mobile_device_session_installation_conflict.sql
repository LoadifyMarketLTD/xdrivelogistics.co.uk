create or replace function public.register_driver_mobile_device_session(
  p_installation_id uuid,
  p_user_id uuid,
  p_driver_id uuid,
  p_auth_session_id uuid,
  p_app_package text,
  p_device_label text default null
)
returns table (
  installation_id uuid,
  auth_session_id uuid,
  auth_session_created_at timestamptz,
  replaced_previous boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_created_at timestamptz;
  v_latest_registered_session_at timestamptz;
  v_same_binding_active boolean;
  v_now timestamptz := now();
begin
  if p_app_package <> 'co.uk.xdrivelogistics.driver' then
    raise exception 'Unsupported Android application package.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.drivers d
    where d.id = p_driver_id
      and d.user_id = p_user_id
  ) then
    raise exception 'Driver identity does not belong to this user.' using errcode = '42501';
  end if;

  select s.created_at
  into v_session_created_at
  from auth.sessions s
  where s.id = p_auth_session_id
    and s.user_id = p_user_id;

  if v_session_created_at is null then
    raise exception 'Authenticated session is no longer active.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_driver_id::text, 0)
  );

  select exists (
    select 1
    from public.driver_mobile_device_sessions d
    where d.driver_id = p_driver_id
      and d.user_id = p_user_id
      and d.installation_id = p_installation_id
      and d.auth_session_id = p_auth_session_id
      and d.enabled = true
      and d.revoked_at is null
  )
  into v_same_binding_active;

  if v_same_binding_active then
    update public.driver_mobile_device_sessions d
    set device_label = nullif(trim(p_device_label), ''),
        app_package = p_app_package,
        last_seen_at = v_now,
        updated_at = v_now
    where d.installation_id = p_installation_id
      and d.auth_session_id = p_auth_session_id;

    return query
      select p_installation_id, p_auth_session_id, v_session_created_at, false;
    return;
  end if;

  select max(d.auth_session_created_at)
  into v_latest_registered_session_at
  from public.driver_mobile_device_sessions d
  where d.driver_id = p_driver_id
    and d.user_id = p_user_id;

  if v_latest_registered_session_at is not null
     and v_session_created_at <= v_latest_registered_session_at then
    raise exception 'This mobile session has been superseded by a newer native login.' using errcode = '42501';
  end if;

  update public.driver_mobile_device_sessions d
  set enabled = false,
      revoked_at = coalesce(d.revoked_at, v_now),
      updated_at = v_now
  where d.driver_id = p_driver_id
    and d.enabled = true
    and d.revoked_at is null;

  insert into public.driver_mobile_device_sessions (
    installation_id,
    user_id,
    driver_id,
    auth_session_id,
    auth_session_created_at,
    platform,
    app_package,
    device_label,
    enabled,
    registered_at,
    last_seen_at,
    revoked_at,
    updated_at
  ) values (
    p_installation_id,
    p_user_id,
    p_driver_id,
    p_auth_session_id,
    v_session_created_at,
    'android',
    p_app_package,
    nullif(trim(p_device_label), ''),
    true,
    v_now,
    v_now,
    null,
    v_now
  )
  on conflict on constraint driver_mobile_device_sessions_pkey do update
  set user_id = excluded.user_id,
      driver_id = excluded.driver_id,
      auth_session_id = excluded.auth_session_id,
      auth_session_created_at = excluded.auth_session_created_at,
      platform = excluded.platform,
      app_package = excluded.app_package,
      device_label = excluded.device_label,
      enabled = true,
      registered_at = excluded.registered_at,
      last_seen_at = excluded.last_seen_at,
      revoked_at = null,
      updated_at = excluded.updated_at;

  return query
    select p_installation_id, p_auth_session_id, v_session_created_at, true;
end;
$$;

revoke all on function public.register_driver_mobile_device_session(uuid, uuid, uuid, uuid, text, text) from public;
revoke all on function public.register_driver_mobile_device_session(uuid, uuid, uuid, uuid, text, text) from anon;
revoke all on function public.register_driver_mobile_device_session(uuid, uuid, uuid, uuid, text, text) from authenticated;
grant execute on function public.register_driver_mobile_device_session(uuid, uuid, uuid, uuid, text, text) to service_role;

comment on function public.register_driver_mobile_device_session(uuid, uuid, uuid, uuid, text, text) is
  'Server-only atomic registration for XDrive Android native device binding. A Supabase Auth session older than the latest registered session can never reclaim the driver binding.';
