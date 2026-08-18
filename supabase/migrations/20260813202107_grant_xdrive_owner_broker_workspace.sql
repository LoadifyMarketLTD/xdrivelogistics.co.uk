insert into public.company_membership_workspace_access (
  company_membership_id,
  workspace_key,
  granted_by,
  reason
)
select
  cm.id,
  'broker',
  u.id,
  'XDrive Logistics owner access to broker workspace'
from auth.users u
join public.profiles p on p.user_id = u.id
join public.company_memberships cm
  on cm.user_id = u.id
 and cm.company_id = p.company_id
 and cm.status = 'active'
where lower(u.email) = lower('xdrivelogisticsltd@gmail.com')
  and p.role = 'owner'
  and p.status = 'active'
  and cm.role_in_company = 'owner'
on conflict (company_membership_id, workspace_key) do update
set granted_at = now(),
    granted_by = excluded.granted_by,
    reason = excluded.reason;
