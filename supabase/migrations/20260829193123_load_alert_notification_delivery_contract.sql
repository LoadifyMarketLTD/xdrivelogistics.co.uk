-- Make load_alert a first-class notification event while preserving recipient
-- channel choices. The canonical outbox stays notification_events.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.fn_notification_event_title(p_event_type text)
returns text
language plpgsql
immutable
security invoker
as $$
begin
  return case p_event_type
    when 'job_assigned'         then 'Job assigned to you'
    when 'bid_accepted'         then 'Your bid was accepted'
    when 'pod_uploaded'         then 'POD uploaded — job delivered'
    when 'bid_rejected'         then 'Bid rejected'
    when 'invoice_dispute'      then 'Invoice dispute raised'
    when 'invoice_disputed'     then 'Invoice dispute raised'
    when 'invoice_created'      then 'Invoice created'
    when 'carrier_invited'      then 'Carrier network invitation'
    when 'carrier_accepted'     then 'Carrier accepted your invitation'
    when 'carrier_rejected'     then 'Carrier declined your invitation'
    when 'onboarding_invite'    then 'Complete your XDrive onboarding'
    when 'onboarding_invite_resent' then 'Complete your XDrive onboarding'
    when 'onboarding_submitted' then 'Onboarding application submitted'
    when 'onboarding_approved'  then 'Your application has been approved'
    when 'onboarding_rejected'  then 'Application requires attention'
    when 'load_alert'           then 'New load matches your alert'
    else initcap(replace(p_event_type, '_', ' '))
  end;
end;
$$;

create or replace function public.fn_notification_event_body(
  p_event_type text,
  p_payload jsonb
)
returns text
language plpgsql
immutable
security invoker
as $$
declare
  v_pickup text;
  v_delivery text;
begin
  v_pickup := nullif(trim(coalesce(p_payload->>'pickup_location', '')), '');
  v_delivery := nullif(trim(coalesce(p_payload->>'delivery_location', '')), '');

  return case p_event_type
    when 'job_assigned' then
      coalesce(v_pickup || ' → ' || v_delivery, 'Check your jobs list for details.')
    when 'bid_accepted' then
      case
        when (p_payload->>'bid_price_gbp') is not null
          then 'Accepted amount: £' || to_char((p_payload->>'bid_price_gbp')::numeric, 'FM999999990.00')
        when (p_payload->>'amount') is not null
          then 'Accepted amount: £' || to_char((p_payload->>'amount')::numeric, 'FM999999990.00')
        else 'A bid on your job has been accepted.'
      end
    when 'pod_uploaded' then
      coalesce(v_pickup || ' → ' || v_delivery, 'The driver has completed delivery.')
    when 'invoice_dispute' then
      coalesce(p_payload->>'reason', 'An invoice dispute has been raised.')
    when 'invoice_disputed' then
      coalesce(p_payload->>'reason', 'An invoice dispute has been raised.')
    when 'carrier_invited' then
      coalesce('Invitation from ' || (p_payload->>'invited_by_name'), 'You have been invited to join a carrier network.')
    when 'load_alert' then
      concat_ws(
        ' ',
        coalesce(nullif(p_payload->>'pickup_outcode', ''), 'Collection area TBC'),
        '→',
        coalesce(nullif(p_payload->>'delivery_outcode', ''), 'Delivery area TBC'),
        case
          when nullif(p_payload->>'vehicle_type', '') is not null
            then '· ' || (p_payload->>'vehicle_type')
          else null
        end
      )
    else
      coalesce(p_payload->>'message', 'Open the platform for details.')
  end;
end;
$$;

create or replace function public.fn_bridge_notification_event_to_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recipient_user_id is null then
    return new;
  end if;

  -- Load Alerts are the first event family with recipient-selectable inbox
  -- delivery. Other operational event types keep their established behaviour.
  if new.event_type = 'load_alert'
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

comment on function public.fn_bridge_notification_event_to_inbox() is
  'Bridges recipient-scoped notification_events into notifications. load_alert honours payload.in_app_enabled; exact marketplace coordinates never enter the inbox payload.';

notify pgrst, 'reload schema';

commit;
