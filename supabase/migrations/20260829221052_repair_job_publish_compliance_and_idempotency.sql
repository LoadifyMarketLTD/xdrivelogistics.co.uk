-- Repair production drift found during authenticated multi-drop Post Load runtime.
-- Publishing a load is a customer/broker action and must not require Driver/
-- Vehicle compliance before a carrier has been selected. Carrier compliance
-- remains enforced for bid, award and execution contexts.
-- Also restore the job creation idempotency contract already expected by the API.

alter table public.jobs
  add column if not exists creation_idempotency_key text;

create unique index if not exists jobs_company_creation_idempotency_uidx
  on public.jobs (company_id, creation_idempotency_key)
  where creation_idempotency_key is not null;

comment on column public.jobs.creation_idempotency_key is
  'Client-generated UUID reused for retries of the same create-job action.';

create or replace function public.company_compliance_issues(
  p_company_id uuid,
  p_context text default null::text
)
returns text[]
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_issues text[] := array[]::text[];
  v_missing_driver_docs text[] := array[]::text[];
  v_missing_vehicle_docs text[] := array[]::text[];
begin
  if p_company_id is null then
    return array['No company context available for compliance validation.'];
  end if;

  if v_role <> 'service_role' then
    if v_actor is null then
      raise exception 'Authentication required.' using errcode = '42501';
    end if;
    if not public.is_owner(v_actor)
       and not exists (
         select 1
         from public.company_memberships cm
         where cm.company_id = p_company_id
           and cm.user_id = v_actor
           and cm.status::text = 'active'
       ) then
      raise exception 'Company compliance access denied.' using errcode = '42501';
    end if;
  end if;

  if lower(coalesce(p_context, '')) = 'publish' then
    return v_issues;
  end if;

  with required_docs as (
    select unnest(array['drivinglicence', 'cpccard', 'insurance']) as normalized_doc
  ),
  present_docs as (
    select distinct public.normalize_doc_type(dd.doc_type) as normalized_doc
    from public.driver_documents dd
    join public.drivers d on d.id = dd.driver_id
    where d.company_id = p_company_id
      and coalesce(d.status, 'active') = 'active'
      and dd.status = 'approved'
      and (dd.expiry_date is null or dd.expiry_date >= current_date)
  )
  select coalesce(array_agg(rd.normalized_doc), array[]::text[])
  into v_missing_driver_docs
  from required_docs rd
  left join present_docs pd on pd.normalized_doc = rd.normalized_doc
  where pd.normalized_doc is null;

  with required_docs as (
    select unnest(array['mot', 'insurance']) as normalized_doc
  ),
  present_docs as (
    select distinct public.normalize_doc_type(vd.doc_type) as normalized_doc
    from public.vehicle_documents vd
    join public.vehicles v on v.id = vd.vehicle_id
    where v.company_id = p_company_id
      and vd.status = 'approved'
      and (vd.expiry_date is null or vd.expiry_date >= current_date)
  )
  select coalesce(array_agg(rd.normalized_doc), array[]::text[])
  into v_missing_vehicle_docs
  from required_docs rd
  left join present_docs pd on pd.normalized_doc = rd.normalized_doc
  where pd.normalized_doc is null;

  if coalesce(array_length(v_missing_driver_docs, 1), 0) > 0 then
    v_issues := array_append(
      v_issues,
      format('Missing approved driver compliance documents: %s.', array_to_string(v_missing_driver_docs, ', '))
    );
  end if;

  if coalesce(array_length(v_missing_vehicle_docs, 1), 0) > 0 then
    v_issues := array_append(
      v_issues,
      format('Missing approved vehicle compliance documents: %s.', array_to_string(v_missing_vehicle_docs, ', '))
    );
  end if;

  return v_issues;
end;
$function$;

revoke all on function public.company_compliance_issues(uuid, text) from public;
grant execute on function public.company_compliance_issues(uuid, text) to authenticated;
grant execute on function public.company_compliance_issues(uuid, text) to service_role;
