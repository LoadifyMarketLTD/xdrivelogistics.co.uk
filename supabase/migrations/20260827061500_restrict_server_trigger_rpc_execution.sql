begin;

-- Trigger functions are invoked by PostgreSQL triggers and must not be exposed
-- through PostgREST RPC to anonymous or authenticated clients.
revoke execute on function public.activate_approved_onboarding_identity() from public, anon, authenticated;
revoke execute on function public.enforce_driver_membership_identity_gate() from public, anon, authenticated;
revoke execute on function public.enforce_driver_profile_identity_gate() from public, anon, authenticated;
revoke execute on function public.enforce_driver_record_identity_gate() from public, anon, authenticated;
revoke execute on function public.fn_validate_invoice_snapshot_integrity() from public, anon, authenticated;
revoke execute on function public.fn_guard_driver_quote_mutation() from public, anon, authenticated;

-- Invite expiry exists in the hosted database as historical drift, but it is not
-- created by the repository migration chain and has no repository/cron caller.
-- Keep it server-only where it exists without making a clean replay depend on
-- an out-of-band function being present.
do $$
begin
  if to_regprocedure('public.expire_invites()') is not null then
    execute 'revoke execute on function public.expire_invites() from public, anon, authenticated';
    execute 'grant execute on function public.expire_invites() to service_role';
  end if;
end;
$$;

grant execute on function public.activate_approved_onboarding_identity() to service_role;
grant execute on function public.enforce_driver_membership_identity_gate() to service_role;
grant execute on function public.enforce_driver_profile_identity_gate() to service_role;
grant execute on function public.enforce_driver_record_identity_gate() to service_role;
grant execute on function public.fn_validate_invoice_snapshot_integrity() to service_role;
grant execute on function public.fn_guard_driver_quote_mutation() to service_role;

commit;
