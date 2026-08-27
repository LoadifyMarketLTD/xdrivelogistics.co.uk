begin;

-- Legacy vehicle tracking mutation had no caller authorization and ran as
-- SECURITY DEFINER. No active application call-site remains; keep it server-only.
revoke execute on function public.update_vehicle_location(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.update_vehicle_location(uuid, text, text, text) to service_role;

-- Temporary-password sequence allocation is an internal provisioning primitive.
revoke execute on function public.next_driver_temp_password_seq() from public, anon, authenticated;
grant execute on function public.next_driver_temp_password_seq() to service_role;

-- This SECURITY DEFINER helper is required by authenticated RLS policies only.
-- Anonymous execution is unnecessary and exposes membership information through RPC.
revoke execute on function public.active_company_membership_role(uuid, uuid) from public, anon;
grant execute on function public.active_company_membership_role(uuid, uuid) to authenticated, service_role;

commit;
