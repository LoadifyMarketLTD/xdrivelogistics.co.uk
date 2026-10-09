begin;

create or replace function public.enqueue_compliance_document_reminders(
  p_days_ahead integer default 30,
  p_company_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days_ahead, 30), 90));
  v_inserted integer := 0;
begin
  with latest_apps as (
    select distinct on (oa.user_id, oa.company_id)
      oa.id,
      oa.user_id,
      oa.company_id,
      oa.account_type
    from public.onboarding_applications oa
    where oa.user_id is not null
      and oa.company_id is not null
      and (p_company_id is null or oa.company_id = p_company_id)
    order by oa.user_id, oa.company_id, oa.created_at desc
  ),
  missing_driver as (
    select
      app.id as application_id,
      app.user_id,
      app.company_id,
      array_agg(distinct missing.doc_type order by missing.doc_type) as missing_documents
    from latest_apps app
    cross join lateral public.get_missing_onboarding_documents(app.id) missing
    where missing.document_family = 'identity'
    group by app.id, app.user_id, app.company_id
  ),
  inserted_missing_driver as (
    insert into public.notification_events (
      event_type, entity_type, entity_id, company_id, recipient_user_id, payload
    )
    select
      'compliance_documents_missing',
      'onboarding_application',
      item.application_id,
      item.company_id,
      item.user_id,
      jsonb_build_object(
        'message', 'Required Driver compliance documents are still missing, unverified or expired.',
        'missing_documents', to_jsonb(item.missing_documents),
        'action_url', '/driver/documents',
        'reminder_kind', 'driver_missing'
      )
    from missing_driver item
    where not exists (
      select 1
      from public.notification_events existing
      where existing.event_type = 'compliance_documents_missing'
        and existing.entity_id = item.application_id
        and existing.recipient_user_id = item.user_id
        and existing.created_at >= now() - interval '7 days'
    )
    returning 1
  ),
  expiring_driver as (
    select
      doc.id as document_id,
      app.user_id,
      app.company_id,
      doc.doc_type,
      doc.expiry_date,
      (doc.expiry_date - current_date)::integer as days_until_expiry
    from latest_apps app
    join public.driver_identity_documents doc
      on doc.onboarding_application_id = app.id
    where doc.verification_status = 'verified'
      and doc.expiry_date is not null
      and doc.expiry_date between current_date and current_date + v_days
  ),
  inserted_expiring_driver as (
    insert into public.notification_events (
      event_type, entity_type, entity_id, company_id, recipient_user_id, payload
    )
    select
      'compliance_document_expiring',
      'driver_identity_document',
      item.document_id,
      item.company_id,
      item.user_id,
      jsonb_build_object(
        'message', initcap(replace(item.doc_type, '_', ' ')) || ' expires in ' || item.days_until_expiry || ' day(s). Upload the renewed document before expiry.',
        'document_type', item.doc_type,
        'expiry_date', item.expiry_date,
        'days_until_expiry', item.days_until_expiry,
        'action_url', '/driver/documents',
        'reminder_kind', 'driver_expiring'
      )
    from expiring_driver item
    where not exists (
      select 1
      from public.notification_events existing
      where existing.event_type = 'compliance_document_expiring'
        and existing.entity_id = item.document_id
        and existing.recipient_user_id = item.user_id
        and existing.created_at >= now() - interval '7 days'
    )
    returning 1
  ),
  operator_members as (
    select cm.company_id, cm.user_id
    from public.company_memberships cm
    where cm.status = 'active'
      and cm.user_id is not null
      and lower(coalesce(cm.role_in_company::text, '')) in ('owner','admin','dispatcher','fleet_manager')
      and (p_company_id is null or cm.company_id = p_company_id)
  ),
  active_vehicles as (
    select v.id, v.company_id, coalesce(nullif(v.reg_plate, ''), nullif(v.registration, ''), 'Vehicle') as vehicle_reference
    from public.vehicles v
    where lower(coalesce(v.status::text, '')) = 'active'
      and (p_company_id is null or v.company_id = p_company_id)
  ),
  vehicle_missing as (
    select
      v.id as vehicle_id,
      v.company_id,
      v.vehicle_reference,
      array_remove(array[
        case when not exists (
          select 1 from public.vehicle_documents d
          where d.vehicle_id = v.id
            and lower(coalesce(d.doc_type, d.document_name, '')) in ('mot','m.o.t','m o t')
            and lower(coalesce(d.status, '')) = 'approved'
            and d.expiry_date is not null
            and d.expiry_date >= current_date
        ) then 'mot' end,
        case when not exists (
          select 1 from public.vehicle_documents d
          where d.vehicle_id = v.id
            and lower(coalesce(d.doc_type, d.document_name, '')) in ('insurance','vehicle_insurance')
            and lower(coalesce(d.status, '')) = 'approved'
            and d.expiry_date is not null
            and d.expiry_date >= current_date
        ) then 'insurance' end
      ], null) as missing_documents
    from active_vehicles v
  ),
  inserted_missing_vehicle as (
    insert into public.notification_events (
      event_type, entity_type, entity_id, company_id, recipient_user_id, payload
    )
    select
      'compliance_documents_missing',
      'vehicle',
      item.vehicle_id,
      item.company_id,
      operator.user_id,
      jsonb_build_object(
        'message', item.vehicle_reference || ' is missing required current compliance documents.',
        'missing_documents', to_jsonb(item.missing_documents),
        'vehicle_reference', item.vehicle_reference,
        'action_url', '/admin/documents?type=vehicle',
        'reminder_kind', 'vehicle_missing'
      )
    from vehicle_missing item
    join operator_members operator on operator.company_id = item.company_id
    where cardinality(item.missing_documents) > 0
      and not exists (
        select 1
        from public.notification_events existing
        where existing.event_type = 'compliance_documents_missing'
          and existing.entity_id = item.vehicle_id
          and existing.recipient_user_id = operator.user_id
          and existing.created_at >= now() - interval '7 days'
      )
    returning 1
  ),
  vehicle_expiring as (
    select
      d.id as document_id,
      v.id as vehicle_id,
      v.company_id,
      v.vehicle_reference,
      coalesce(nullif(d.doc_type, ''), nullif(d.document_name, ''), 'document') as doc_type,
      d.expiry_date,
      (d.expiry_date - current_date)::integer as days_until_expiry
    from active_vehicles v
    join public.vehicle_documents d on d.vehicle_id = v.id
    where lower(coalesce(d.status, '')) = 'approved'
      and d.expiry_date is not null
      and d.expiry_date between current_date and current_date + v_days
  ),
  inserted_expiring_vehicle as (
    insert into public.notification_events (
      event_type, entity_type, entity_id, company_id, recipient_user_id, payload
    )
    select
      'compliance_document_expiring',
      'vehicle_document',
      item.document_id,
      item.company_id,
      operator.user_id,
      jsonb_build_object(
        'message', item.vehicle_reference || ': ' || initcap(replace(item.doc_type, '_', ' ')) || ' expires in ' || item.days_until_expiry || ' day(s).',
        'document_type', item.doc_type,
        'vehicle_id', item.vehicle_id,
        'vehicle_reference', item.vehicle_reference,
        'expiry_date', item.expiry_date,
        'days_until_expiry', item.days_until_expiry,
        'action_url', '/admin/documents?type=vehicle',
        'reminder_kind', 'vehicle_expiring'
      )
    from vehicle_expiring item
    join operator_members operator on operator.company_id = item.company_id
    where not exists (
      select 1
      from public.notification_events existing
      where existing.event_type = 'compliance_document_expiring'
        and existing.entity_id = item.document_id
        and existing.recipient_user_id = operator.user_id
        and existing.created_at >= now() - interval '7 days'
    )
    returning 1
  )
  select
    (select count(*) from inserted_missing_driver)
    + (select count(*) from inserted_expiring_driver)
    + (select count(*) from inserted_missing_vehicle)
    + (select count(*) from inserted_expiring_vehicle)
  into v_inserted;

  return v_inserted;
end;
$$;

revoke all on function public.enqueue_compliance_document_reminders(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_compliance_document_reminders(integer, uuid)
  to service_role;

comment on function public.enqueue_compliance_document_reminders(integer, uuid) is
  'Queues duplicate-safe weekly reminders for missing/expiring Driver identity and Fleet vehicle compliance documents.';

create or replace function public.dispatch_daily_compliance_document_reminders()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.enqueue_compliance_document_reminders(30, null);
end;
$$;

revoke all on function public.dispatch_daily_compliance_document_reminders()
  from public, anon, authenticated;
grant execute on function public.dispatch_daily_compliance_document_reminders()
  to service_role;

create extension if not exists pg_cron;

select cron.schedule(
  'xdrive-daily-compliance-document-reminders',
  '15 7 * * *',
  $cron$select public.dispatch_daily_compliance_document_reminders();$cron$
);

notify pgrst, 'reload schema';
commit;
