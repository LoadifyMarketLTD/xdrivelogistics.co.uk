with company_vehicle_counts as (
  select c.id as company_id, count(v.id)::int as vehicle_count
  from public.companies c
  left join public.vehicles v on v.company_id = c.id
  group by c.id
), internal_platform_companies as (
  select distinct cm.company_id
  from public.company_memberships cm
  join public.profiles p on p.user_id = cm.user_id
  where lower(coalesce(cm.status::text, '')) = 'active'
    and lower(coalesce(p.status::text, 'active')) = 'active'
    and p.role::text = 'owner'
), eligible as (
  select
    cm.user_id,
    cm.company_id,
    case
      when lower(c.company_type::text) = 'customer' then 'customer-shipper'
      when lower(c.company_type::text) = 'sole_trader' or lower(coalesce(p.role::text, '')) = 'driver' then 'owner-driver'
      when lower(coalesce(p.role::text, '')) = 'broker' then 'broker'
      when lower(c.company_type::text) = 'standard' and coalesce(cvc.vehicle_count, 0) between 2 and 5 then 'small-carrier'
      when lower(c.company_type::text) = 'standard' and coalesce(cvc.vehicle_count, 0) between 6 and 15 then 'growing-carrier'
      when lower(c.company_type::text) = 'standard' and coalesce(cvc.vehicle_count, 0) between 16 and 50 then 'fleet'
      else null
    end as plan_id
  from public.company_memberships cm
  join public.companies c on c.id = cm.company_id
  join public.profiles p on p.user_id = cm.user_id
  left join company_vehicle_counts cvc on cvc.company_id = cm.company_id
  where lower(coalesce(cm.status::text, '')) = 'active'
    and lower(coalesce(c.status::text, '')) = 'active'
    and lower(coalesce(p.status::text, 'active')) = 'active'
    and not exists (
      select 1 from internal_platform_companies ipc where ipc.company_id = cm.company_id
    )
)
insert into public.platform_membership_subscriptions (
  user_id,
  company_id,
  plan_id,
  status,
  trial_started_at,
  trial_ends_at,
  contract_terms_version,
  contract_accepted_at
)
select
  e.user_id,
  e.company_id,
  e.plan_id,
  'trialing',
  timestamptz '2026-09-03 00:00:00+01',
  timestamptz '2026-12-03 00:00:00+00',
  '2026-09-01',
  null
from eligible e
where e.plan_id is not null
  and not exists (
    select 1
    from public.platform_membership_subscriptions s
    where s.user_id = e.user_id
      and s.company_id = e.company_id
  );
