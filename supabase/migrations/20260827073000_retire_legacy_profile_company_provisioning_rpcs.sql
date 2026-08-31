begin;

-- Legacy provisioning primitives predate the canonical onboarding and membership
-- bootstrap contracts. They permit caller-controlled role/status or parallel
-- company creation paths and have no current runtime call-sites. Hosted history
-- may contain overloads whose enum types/functions do not exist in a clean repo
-- replay, so secure every existing overload by OID instead of requiring those
-- historical signatures to parse.
do $$
declare
  v_proc record;
begin
  for v_proc in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'ensure_profile',
        'register_company_pending',
        'register_broker_pending',
        'create_company'
      )
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      v_proc.oid::regprocedure
    );
    execute format(
      'grant execute on function %s to service_role',
      v_proc.oid::regprocedure
    );
  end loop;
end;
$$;

commit;
