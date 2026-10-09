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
    when 'pod_uploaded' then 'POD uploaded - job delivered'
    when 'load_alert' then 'New load matches your alert'
    when 'tracking_eta_alert' then 'Delivery ETA alert'
    when 'pickup_proximity_alert' then 'Driver near pickup'
    when 'delivery_proximity_alert' then 'Driver near delivery'
    when 'job_on_site_pickup_alert' then 'Driver on site at pickup'
    when 'job_loaded_alert' then 'Load collected'
    when 'job_on_site_delivery_alert' then 'Driver on site at delivery'
    when 'job_pod_submitted_alert' then 'POD submitted'
    when 'invoice_dispute' then 'Invoice dispute raised'
    when 'invoice_created' then 'Invoice created'
    when 'onboarding_invite' then 'Complete onboarding'
    when 'onboarding_approved' then 'Onboarding approved'
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
    when 'tracking_eta_alert' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'Traffic conditions may affect the planned delivery time.')
    when 'pickup_proximity_alert' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'The assigned vehicle is near pickup.')
    when 'delivery_proximity_alert' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'The assigned vehicle is near delivery.')
    when 'job_on_site_pickup_alert' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'The driver is on site at pickup.')
    when 'job_loaded_alert' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'The load has been collected.')
    when 'job_on_site_delivery_alert' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'The driver is on site at delivery.')
    when 'job_pod_submitted_alert' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'POD has been submitted.')
    when 'pod_uploaded' then coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'The delivery has been completed and POD is available.')
    else coalesce(nullif(trim(coalesce(p_payload->>'message','')),''), 'Open XDrive for details.')
  end
$$;

create or replace function public.fn_bridge_notification_event_to_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Broadcast rows cannot be represented in the recipient-scoped inbox.
  if new.recipient_user_id is null then
    return new;
  end if;

  -- Smart / Pro Alerts can explicitly disable in-app delivery while retaining
  -- email/push. Existing events without this payload flag remain in-app by default.
  if new.payload ? 'in_app_enabled'
     and coalesce((new.payload->>'in_app_enabled')::boolean, true) = false then
    return new;
  end if;

  insert into public.notifications (
    id,
    company_id,
    user_id,
    title,
    body,
    type,
    created_at
  ) values (
    new.id,
    new.company_id,
    new.recipient_user_id,
    public.fn_notification_event_title(new.event_type),
    public.fn_notification_event_body(new.event_type, new.payload),
    new.event_type,
    new.created_at
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

notify pgrst, 'reload schema';
commit;
