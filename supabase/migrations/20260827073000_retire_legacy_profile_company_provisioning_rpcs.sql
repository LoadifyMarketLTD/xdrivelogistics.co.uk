begin;

-- Legacy provisioning primitives predate the canonical onboarding and membership
-- bootstrap contracts. They permit caller-controlled role/status or parallel
-- company creation paths and have no current runtime call-sites. Keep them
-- available only to trusted server maintenance code.
revoke execute on function public.ensure_profile(public.user_role, public.user_status, text, text) from public, anon, authenticated;
revoke execute on function public.register_company_pending(text, text, text) from public, anon, authenticated;
revoke execute on function public.register_broker_pending(text, text) from public, anon, authenticated;
revoke execute on function public.create_company(text, text) from public, anon, authenticated;
revoke execute on function public.create_company(text) from public, anon, authenticated;

grant execute on function public.ensure_profile(public.user_role, public.user_status, text, text) to service_role;
grant execute on function public.register_company_pending(text, text, text) to service_role;
grant execute on function public.register_broker_pending(text, text) to service_role;
grant execute on function public.create_company(text, text) to service_role;
grant execute on function public.create_company(text) to service_role;

commit;
