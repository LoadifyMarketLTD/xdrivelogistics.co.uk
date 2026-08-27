create or replace function public.replace_driver_return_journey(
  p_driver_id uuid,
  p_company_id uuid,
  p_from_location text,
  p_to_location text,
  p_available_date timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if nullif(trim(p_from_location), '') is null and nullif(trim(p_to_location), '') is null then
    raise exception 'A journey location is required.' using errcode = '22023';
  end if;

  delete from public.return_journeys where driver_id = p_driver_id;

  insert into public.return_journeys (
    id,
    driver_id,
    company_id,
    from_location,
    to_location,
    available_date,
    created_at
  ) values (
    v_id,
    p_driver_id,
    p_company_id,
    nullif(trim(p_from_location), ''),
    nullif(trim(p_to_location), ''),
    p_available_date,
    now()
  );

  return v_id;
end;
$$;

revoke all on function public.replace_driver_return_journey(uuid, uuid, text, text, timestamptz) from public;
revoke all on function public.replace_driver_return_journey(uuid, uuid, text, text, timestamptz) from anon;
revoke all on function public.replace_driver_return_journey(uuid, uuid, text, text, timestamptz) from authenticated;
grant execute on function public.replace_driver_return_journey(uuid, uuid, text, text, timestamptz) to service_role;

comment on function public.replace_driver_return_journey(uuid, uuid, text, text, timestamptz) is
  'Server-only atomic replacement of the current Android driver return journey.';
