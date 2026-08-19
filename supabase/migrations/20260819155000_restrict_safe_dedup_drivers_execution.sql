-- Restrict the administrative driver deduplication helper after repairing its
-- live/fresh schema drift in 20260819154000.
--
-- safe_dedup_drivers(uuid) is SECURITY DEFINER and can deactivate/delete driver
-- records. It is an administrative maintenance helper, not an end-user RPC.
-- Historical migration 057 granted EXECUTE to authenticated; once the helper is
-- made functional against the current drivers schema, retaining that grant would
-- expose a destructive cross-company operation to signed-in users.
--
-- No application runtime path calls this helper. Keep it available only to the
-- service role for controlled maintenance.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.safe_dedup_drivers(uuid)') IS NULL THEN
    RAISE EXCEPTION 'safe_dedup_drivers(uuid) must exist before execution grants are restricted.'
      USING ERRCODE = '42883';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.safe_dedup_drivers(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.safe_dedup_drivers(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.safe_dedup_drivers(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.safe_dedup_drivers(uuid) TO service_role;

COMMENT ON FUNCTION public.safe_dedup_drivers(uuid) IS
  'Administrative duplicate-driver cleanup helper. SECURITY DEFINER; executable only by service_role after validating duplicate/open-job safety.';

NOTIFY pgrst, 'reload schema';

COMMIT;
