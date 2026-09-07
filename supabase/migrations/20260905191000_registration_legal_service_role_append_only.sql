-- Supabase default table privileges grant service_role more than the explicit
-- SELECT/INSERT access intended by the initial legal evidence migration.
-- Keep application-level legal evidence strictly append-only: trusted server
-- code may read and insert evidence, but cannot update, delete or truncate it.

begin;

revoke all on table public.registration_legal_acceptances from service_role;
grant select, insert on table public.registration_legal_acceptances to service_role;

-- The trigger function is not an RPC. Browser roles remain unable to execute it;
-- service_role keeps explicit execution capability for trigger runtime semantics.
revoke all on function public.prevent_registration_legal_acceptance_mutation() from public, anon, authenticated;
grant execute on function public.prevent_registration_legal_acceptance_mutation() to service_role;

commit;

notify pgrst, 'reload schema';
