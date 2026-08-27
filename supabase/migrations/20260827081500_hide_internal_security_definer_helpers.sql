begin;

revoke execute on function public.can_quote_marketplace_job(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.assert_company_status_transition(text, text) from public, anon, authenticated;

grant execute on function public.can_quote_marketplace_job(uuid, uuid) to service_role;
grant execute on function public.assert_company_status_transition(text, text) to service_role;

commit;
