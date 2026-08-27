begin;

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

create or replace function public.next_invoice_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_prefix text;
  v_count int;
begin
  if p_company_id is null then
    raise exception 'Company id is required.' using errcode = '22023';
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
      raise exception 'Invoice number access denied.' using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company_id::text));
  v_prefix := 'INV-' || to_char(now(), 'YYYYMM') || '-';

  select count(*) + 1
    into v_count
    from public.invoices
   where company_id = p_company_id
     and invoice_number like v_prefix || '%';

  return v_prefix || lpad(v_count::text, 3, '0');
end;
$function$;

revoke execute on function public.company_compliance_issues(uuid, text) from public, anon;
revoke execute on function public.next_invoice_number(uuid) from public, anon;
grant execute on function public.company_compliance_issues(uuid, text) to authenticated, service_role;
grant execute on function public.next_invoice_number(uuid) to authenticated, service_role;

commit;
