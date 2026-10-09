begin;

create or replace function public.fn_notification_event_title(p_event_type text)
returns text
language sql
immutable
security invoker
as $$
  select case p_event_type
    when 'job_assigned' then 'Job assigned to you'
    when 'bid_accepted' then 'Your bid was accepted'
    when 'pod_uploaded' then 'POD uploaded — job delivered'
    when 'tracking_eta_alert' then 'Traffic ETA alert'
    when 'invoice_dispute' then 'Invoice dispute raised'
    when 'invoice_created' then 'Invoice created'
    when 'onboarding_invite' then 'Complete onboarding'
    when 'onboarding_approved' then 'Onboarding approved'
    when 'compliance_documents_missing' then 'Compliance documents required'
    when 'compliance_document_expiring' then 'Compliance document expiry'
    else initcap(replace(coalesce(p_event_type, 'notification'), '_', ' '))
  end
$$;

create or replace function public.fn_notification_event_body(p_event_type text, p_payload jsonb)
returns text
language sql
immutable
security invoker
as $$
  select case p_event_type
    when 'job_assigned' then coalesce(nullif(trim(coalesce(p_payload->>'pickup_location','')),'') || ' → ' || nullif(trim(coalesce(p_payload->>'delivery_location','')),''), 'Check your jobs list for details.')
    when 'tracking_eta_alert' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'Traffic conditions may affect the planned delivery time.')
    when 'pod_uploaded' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'The delivery has been completed and POD is available.')
    when 'compliance_documents_missing' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'Required compliance documents are still outstanding.')
    when 'compliance_document_expiring' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'A compliance document is approaching expiry.')
    else coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'Open XDrive for details.')
  end
$$;

notify pgrst, 'reload schema';
commit;
