begin;

-- Trigger functions are invoked by PostgreSQL triggers and must not be exposed
-- through PostgREST RPC to anonymous or authenticated clients.
revoke execute on function public.activate_approved_onboarding_identity() from public, anon, authenticated;
revoke execute on function public.enforce_driver_membership_identity_gate() from public, anon, authenticated;
revoke execute on function public.enforce_driver_profile_identity_gate() from public, anon, authenticated;
revoke execute on function public.enforce_driver_record_identity_gate() from public, anon, authenticated;
revoke execute on function public.fn_validate_invoice_snapshot_integrity() from public, anon, authenticated;
revoke execute on function public.fn_guard_driver_quote_mutation() from public, anon, authenticated;

-- Invite expiry is a maintenance operation with no caller-specific authorization
-- in the function body. Keep it server-only.
revoke execute on function public.expire_invites() from public, anon, authenticated;

grant execute on function public.activate_approved_onboarding_identity() to service_role;
grant execute on function public.enforce_driver_membership_identity_gate() to service_role;
grant execute on function public.enforce_driver_profile_identity_gate() to service_role;
grant execute on function public.enforce_driver_record_identity_gate() to service_role;
grant execute on function public.fn_validate_invoice_snapshot_integrity() to service_role;
grant execute on function public.fn_guard_driver_quote_mutation() to service_role;
grant execute on function public.expire_invites() to service_role;

commit;
