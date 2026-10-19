-- Emit one feedback invitation per authorised company operator when a marketplace booking first completes.
-- Buyer and executing carrier are both eligible reviewers. Internal same-company work is excluded.

begin;

create or replace function public.fn_enqueue_feedback_requests_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_new_status text;
  v_buyer_company_id uuid;
  v_carrier_company_id uuid;
begin
  v_old_status := lower(trim(coalesce(old.current_status, old.status, '')));
  v_new_status := lower(trim(coalesce(new.current_status, new.status, '')));

  if v_new_status <> 'completed' or v_old_status = 'completed' then
    return new;
  end if;

  v_buyer_company_id := new.company_id;
  v_carrier_company_id := coalesce(new.awarded_carrier_company_id, new.assigned_company_id);

  if v_buyer_company_id is null
     or v_carrier_company_id is null
     or v_buyer_company_id = v_carrier_company_id then
    return new;
  end if;

  insert into public.notification_events (
    event_type,
    entity_type,
    entity_id,
    company_id,
    recipient_user_id,
    payload,
    status,
    idempotency_key
  )
  select
    'feedback_requested',
    'job',
    new.id,
    reviewer.company_id,
    member.user_id,
    jsonb_strip_nulls(jsonb_build_object(
      'job_id', new.id,
      'booking_reference', nullif(trim(coalesce(new.booking_reference, '')), ''),
      'customer_reference', nullif(trim(coalesce(new.customer_reference, '')), ''),
      'load_id', nullif(trim(coalesce(new.load_id, '')), ''),
      'reviewer_company_id', reviewer.company_id,
      'counterparty_company_id', reviewer.counterparty_company_id,
      'message', 'This completed booking is ready for company feedback.'
    )),
    'pending',
    'feedback-request:' || new.id::text || ':' || reviewer.company_id::text || ':' || member.user_id::text
  from (
    values
      (v_buyer_company_id, v_carrier_company_id),
      (v_carrier_company_id, v_buyer_company_id)
  ) as reviewer(company_id, counterparty_company_id)
  join public.company_memberships member
    on member.company_id = reviewer.company_id
   and member.status = 'active'
   and member.role_in_company in ('owner', 'admin', 'dispatcher')
   and member.user_id is not null
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.fn_enqueue_feedback_requests_on_completion()
  from public, anon, authenticated;
grant execute on function public.fn_enqueue_feedback_requests_on_completion()
  to service_role;

drop trigger if exists trg_enqueue_feedback_requests_on_completion on public.jobs;
create trigger trg_enqueue_feedback_requests_on_completion
  after update of status, current_status on public.jobs
  for each row
  execute function public.fn_enqueue_feedback_requests_on_completion();

comment on function public.fn_enqueue_feedback_requests_on_completion()
is 'Queues idempotent bidirectional company feedback invitations when an external marketplace booking first reaches completed.';

commit;
