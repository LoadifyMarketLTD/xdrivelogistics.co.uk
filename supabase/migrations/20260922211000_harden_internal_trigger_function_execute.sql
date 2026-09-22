BEGIN;

-- These functions are trigger implementation details, not public RPC endpoints.
-- Keep trigger execution semantics intact while removing PostgREST exposure to
-- anonymous and ordinary authenticated clients.

REVOKE ALL ON FUNCTION public.fn_enrich_invoice_on_job_completion()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_enrich_invoice_on_job_completion()
  TO service_role;

REVOKE ALL ON FUNCTION public.fn_finalize_invoice_pod_snapshot()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_finalize_invoice_pod_snapshot()
  TO service_role;

REVOKE ALL ON FUNCTION public.fn_guard_quote_vehicle_compliance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_guard_quote_vehicle_compliance()
  TO service_role;

REVOKE ALL ON FUNCTION public.prevent_xdrive_identity_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_xdrive_identity_change()
  TO service_role;

COMMENT ON FUNCTION public.fn_enrich_invoice_on_job_completion() IS
  'Internal trigger function. Not callable by browser roles.';
COMMENT ON FUNCTION public.fn_finalize_invoice_pod_snapshot() IS
  'Internal trigger function. Not callable by browser roles.';
COMMENT ON FUNCTION public.fn_guard_quote_vehicle_compliance() IS
  'Internal trigger function. Not callable by browser roles.';
COMMENT ON FUNCTION public.prevent_xdrive_identity_change() IS
  'Internal trigger function. Not callable by browser roles.';

NOTIFY pgrst, 'reload schema';

COMMIT;
