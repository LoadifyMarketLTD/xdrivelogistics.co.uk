begin;

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

  if new.payload ? 'in_app_enabled'
     and coalesce((new.payload->>'in_app_enabled')::boolean, true) = false then
    return new;
  end if;

  insert into public.notifications (
    id, company_id, user_id, title, body, type, created_at
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
