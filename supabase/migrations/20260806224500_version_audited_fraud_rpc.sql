-- Publish a versioned, audit-guaranteed fraud governance RPC.
--
-- Migration 20260806223000 repairs the canonical
-- owner_decide_fraud_review_case(uuid, uuid, text, text) function so every
-- successful action, including an idempotent no-state-change action, persists an
-- owner_audit_log row before returning success.
--
-- The application calls this versioned wrapper instead of the historical RPC
-- name. This makes mixed deployment order fail closed:
--   - application first: the wrapper is absent, so PostgREST rejects the call and
--     no business mutation occurs;
--   - migrations first: the canonical function is repaired before this wrapper is
--     exposed, so both old and new callers use audited behaviour.
--
-- This migration is committed only; it is not applied to any environment here.

BEGIN;

DO $migration$
BEGIN
  IF to_regprocedure(
    'public.owner_decide_fraud_review_case(uuid,uuid,text,text)'
  ) IS NULL THEN
    RAISE NOTICE
      '20260806224500: canonical fraud governance RPC does not exist; audited wrapper was not created.';
    RETURN;
  END IF;

  EXECUTE $WRAPPER$
    CREATE OR REPLACE FUNCTION public.owner_decide_fraud_review_case_audited(
      p_actor_user_id uuid,
      p_case_id uuid,
      p_action text,
      p_reason text
    )
    RETURNS TABLE (case_id uuid, old_status text, new_status text)
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $body$
      SELECT *
      FROM public.owner_decide_fraud_review_case($1, $2, $3, $4);
    $body$
  $WRAPPER$;

  EXECUTE $REVOKE_PUBLIC$
    REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case_audited(uuid, uuid, text, text) FROM PUBLIC
  $REVOKE_PUBLIC$;

  EXECUTE $REVOKE_AUTHENTICATED$
    REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case_audited(uuid, uuid, text, text) FROM authenticated
  $REVOKE_AUTHENTICATED$;

  EXECUTE $REVOKE_ANON$
    REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case_audited(uuid, uuid, text, text) FROM anon
  $REVOKE_ANON$;

  EXECUTE $GRANT_SERVICE_ROLE$
    GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case_audited(uuid, uuid, text, text) TO service_role
  $GRANT_SERVICE_ROLE$;

  EXECUTE $COMMENT$
    COMMENT ON FUNCTION public.owner_decide_fraud_review_case_audited(uuid, uuid, text, text)
    IS 'Versioned Platform Owner fraud governance entry point. Delegates to the atomic audit-guaranteed canonical RPC.'
  $COMMENT$;

  RAISE NOTICE
    '20260806224500: versioned audited fraud governance RPC created for service_role only.';
END;
$migration$;

COMMIT;

NOTIFY pgrst, 'reload schema';
