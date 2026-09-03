create unique index if not exists platform_membership_subscriptions_company_uq
on public.platform_membership_subscriptions(company_id)
where company_id is not null;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create or replace function private.ensure_xdrive_commercial_trial_for_active_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id text;
  v_company_type text;
  v_profile_role text;
  v_vehicle_count integer := 0;
  v_internal_platform_company boolean := false;
begin
  if lower(coalesce(new.status::text, '')) <> 'active' then
    return new;
  end if;

  if exists (
    select 1
    from public.platform_membership_subscriptions s
    where s.company_id = new.company_id
  ) then
    return new;
  end if;

  select exists (
    select 1
    from public.company_memberships cm
    join public.profiles p on p.user_id = cm.user_id
    where cm.company_id = new.company_id
      and lower(coalesce(cm.status::text, '')) = 'active'
      and lower(coalesce(p.status::text, 'active')) = 'active'
      and p.role::text = 'owner'
  ) into v_internal_platform_company;

  if v_internal_platform_company then
    return new;
  end if;

  select lower(coalesce(c.company_type::text, ''))
  into v_company_type
  from public.companies c
  where c.id = new.company_id
    and lower(coalesce(c.status::text, '')) = 'active';

  if v_company_type is null or v_company_type = '' then
    return new;
  end if;

  select lower(coalesce(p.role::text, ''))
  into v_profile_role
  from public.profiles p
  where p.user_id = new.user_id
    and lower(coalesce(p.status::text, 'active')) = 'active';

  if v_company_type = 'customer' then
    v_plan_id := 'customer-shipper';
  elsif v_company_type = 'sole_trader' or v_profile_role = 'driver' then
    v_plan_id := 'owner-driver';
  elsif v_profile_role = 'broker' then
    v_plan_id := 'broker';
  elsif v_company_type = 'standard' then
    select count(*)::integer
    into v_vehicle_count
    from public.vehicles v
    where v.company_id = new.company_id;

    if v_vehicle_count between 2 and 5 then
      v_plan_id := 'small-carrier';
    elsif v_vehicle_count between 6 and 15 then
      v_plan_id := 'growing-carrier';
    elsif v_vehicle_count between 16 and 50 then
      v_plan_id := 'fleet';
    else
      return new;
    end if;
  else
    return new;
  end if;

  begin
    insert into public.platform_membership_subscriptions (
      user_id,
      company_id,
      plan_id,
      status,
      trial_started_at,
      trial_ends_at,
      contract_terms_version,
      contract_accepted_at
    ) values (
      new.user_id,
      new.company_id,
      v_plan_id,
      'trialing',
      now(),
      now() + interval '3 months',
      '2026-09-01',
      null
    );
  exception
    when unique_violation then
      null;
  end;

  return new;
end;
$$;

revoke execute on function private.ensure_xdrive_commercial_trial_for_active_membership() from public;
revoke execute on function private.ensure_xdrive_commercial_trial_for_active_membership() from anon, authenticated;

drop trigger if exists trg_ensure_xdrive_commercial_trial_for_active_membership
on public.company_memberships;

create trigger trg_ensure_xdrive_commercial_trial_for_active_membership
after insert or update of status, company_id, user_id
on public.company_memberships
for each row
execute function private.ensure_xdrive_commercial_trial_for_active_membership();

comment on function private.ensure_xdrive_commercial_trial_for_active_membership() is
'Creates one server-governed three-calendar-month XDrive trial when an eligible commercial company membership becomes active. Platform Owner companies and Enterprise/indeterminate fleet tiers are excluded.';
