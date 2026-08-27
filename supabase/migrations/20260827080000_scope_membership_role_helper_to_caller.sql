begin;

create or replace function public.active_company_membership_role(
  p_company_id uuid,
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when coalesce(auth.role(), '') = 'service_role' or p_user_id = auth.uid() then (
      select cm.role_in_company::text
      from public.company_memberships cm
      join public.companies c on c.id = cm.company_id
      where cm.company_id = p_company_id
        and cm.user_id = p_user_id
        and cm.status::text = 'active'
        and c.status::text = 'active'
      limit 1
    )
    else null
  end;
$function$;

revoke execute on function public.active_company_membership_role(uuid, uuid) from public, anon;
grant execute on function public.active_company_membership_role(uuid, uuid) to authenticated, service_role;

commit;
