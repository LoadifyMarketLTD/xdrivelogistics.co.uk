-- Real-database PreLive commercial award authority regression test.
-- Run only against a disposable/local/staging database after all migrations.
-- This test does not create or award a real job; it verifies the final DB
-- authority entrypoint, privileges and delegation contract.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
END;
$$;

SELECT pg_temp.assert_true(
  to_regprocedure('public.accept_job_bid_atomic(uuid,uuid)') IS NOT NULL,
  'Canonical award wrapper is missing.'
);

SELECT pg_temp.assert_true(
  to_regprocedure('public.accept_job_bid_atomic_award_authority_base_v1(uuid,uuid)') IS NOT NULL,
  'Private approved award base is missing.'
);

SELECT pg_temp.assert_true(
  NOT has_function_privilege(
    'authenticated',
    'public.accept_job_bid_atomic(uuid,uuid)',
    'EXECUTE'
  ),
  'Authenticated users can execute the service-controlled award RPC directly.'
);

SELECT pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.accept_job_bid_atomic(uuid,uuid)',
    'EXECUTE'
  ),
  'Service role cannot execute the canonical award RPC.'
);

SELECT pg_temp.assert_true(
  NOT has_function_privilege(
    'service_role',
    'public.accept_job_bid_atomic_award_authority_base_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'Service role can bypass the active-company wrapper through the private base.'
);

SELECT pg_temp.assert_true(
  position(
    'COALESCE(c.status::text, '''') = ''active'''
    in pg_get_functiondef('public.accept_job_bid_atomic(uuid,uuid)'::regprocedure)
  ) > 0,
  'Award wrapper does not require the job-owning company to be active.'
);

SELECT pg_temp.assert_true(
  position(
    'COALESCE(cm.status::text, '''') = ''active'''
    in pg_get_functiondef('public.accept_job_bid_atomic(uuid,uuid)'::regprocedure)
  ) > 0,
  'Award wrapper does not require active company membership.'
);

SELECT pg_temp.assert_true(
  position(
    'FOR SHARE OF cm, c'
    in pg_get_functiondef('public.accept_job_bid_atomic(uuid,uuid)'::regprocedure)
  ) > 0,
  'Award authority rows are not locked against a suspension/deactivation race.'
);

DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.accept_job_bid_atomic(
    '23000000-0000-0000-0000-000000000001'::uuid,
    '23000000-0000-0000-0000-000000000002'::uuid
  );

  IF COALESCE((v_result ->> 'http_status')::integer, 0) <> 404
     OR COALESCE((v_result ->> 'success')::boolean, true) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Canonical award wrapper did not preserve base NOT_FOUND semantics: %', v_result;
  END IF;
END;
$$;

SELECT pass('Active-company commercial award authority DB contract passed.');
SELECT * FROM finish();
ROLLBACK;
