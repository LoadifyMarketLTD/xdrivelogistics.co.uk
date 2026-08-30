BEGIN;

-- P0-05: retire legacy award entry points.
-- The canonical award path is public.accept_job_bid_atomic(uuid, uuid), which is
-- service-role only and preserves bid/job/company/commercial-agreement invariants.
-- Neither accept_bid overload has a current source consumer; one mutates only
-- jobs.status/awarded_bid_id and the other targets the removed public.bids table.

DROP FUNCTION IF EXISTS public.accept_bid(uuid);
DROP FUNCTION IF EXISTS public.accept_bid(uuid, uuid);

DO $$
DECLARE
  v_legacy_count integer;
  v_canonical_acl text;
  v_canonical_def text;
BEGIN
  SELECT count(*)
  INTO v_legacy_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'accept_bid';

  IF v_legacy_count <> 0 THEN
    RAISE EXCEPTION 'Legacy accept_bid overloads still exist after retirement: %', v_legacy_count;
  END IF;

  SELECT p.proacl::text, pg_get_functiondef(p.oid)
  INTO v_canonical_acl, v_canonical_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'accept_job_bid_atomic'
    AND pg_get_function_identity_arguments(p.oid) = 'p_bid_id uuid, p_actor_user_id uuid'
  LIMIT 1;

  IF v_canonical_def IS NULL THEN
    RAISE EXCEPTION 'Canonical accept_job_bid_atomic(uuid, uuid) is missing.';
  END IF;

  IF has_function_privilege('anon', 'public.accept_job_bid_atomic(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.accept_job_bid_atomic(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Canonical award RPC is unexpectedly executable by client roles.';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.accept_job_bid_atomic(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Canonical award RPC is not executable by service_role.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
