-- Real-database PreLive regression for owner-driver submit compatibility with the
-- current public.drivers physical contract. Disposable/local/staging only.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

SELECT ok(
  to_regprocedure('public.submit_onboarding_application_base_v1(uuid)') IS NOT NULL,
  'Preserved owner-driver onboarding base function exists'
);

SELECT like(
  pg_get_functiondef('public.submit_onboarding_application_base_v1(uuid)'::regprocedure),
  '%name,%full_name,%display_name,%',
  'Owner-driver INSERT populates name, full_name and display_name'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.submit_onboarding_application_base_v1(uuid)',
    'EXECUTE'
  ),
  'Authenticated callers cannot bypass the public onboarding wrapper'
);

SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.submit_onboarding_application_base_v1(uuid)',
    'EXECUTE'
  ),
  'Service role cannot bypass the public onboarding wrapper directly'
);

SELECT * FROM finish();
ROLLBACK;
