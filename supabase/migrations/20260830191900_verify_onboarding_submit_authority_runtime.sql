BEGIN;

-- P0-07 hosted proof. Uses only ACL inspection plus one rollback-only mutation
-- against the single active verified Owner Driver identity, avoiding any
-- third-party account as a test fixture.
DO $$
DECLARE
  v_application_id uuid;
  v_user_id uuid;
  v_original_status text;
  v_rejected boolean := false;
BEGIN
  IF has_function_privilege('authenticated', 'public.submit_onboarding_application(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated can still execute the legacy one-argument submit RPC.';
  END IF;

  IF has_function_privilege('authenticated', 'public.submit_onboarding_application(uuid,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated can still execute the actor-bound submit RPC.';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.submit_onboarding_application(uuid)'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.submit_onboarding_application(uuid,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Service submission authority is unavailable during staged rollout.';
  END IF;

  SELECT oa.id, oa.user_id, oa.status::text
  INTO v_application_id, v_user_id, v_original_status
  FROM public.platform_identity_registry i
  JOIN public.onboarding_applications oa
    ON oa.user_id = i.user_id
   AND oa.company_id = i.company_id
  WHERE i.identity_mode = 'owner_driver'
    AND i.status = 'active'
    AND i.verified_at IS NOT NULL
  ORDER BY i.created_at
  LIMIT 1;

  IF v_application_id IS NULL THEN
    RAISE EXCEPTION 'No active verified Owner Driver application is available for P0-07 rollback proof.';
  END IF;

  BEGIN
    PERFORM public.submit_onboarding_application(v_application_id, gen_random_uuid());
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Actor-bound submit accepted a user id that does not own the application.';
  END IF;

  -- Prove legacy/dead submit states are normalized before the canonical check
  -- constraint, then deliberately roll the mutation back.
  BEGIN
    UPDATE public.onboarding_applications
    SET status = 'submitted', last_activity_at = now()
    WHERE id = v_application_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.onboarding_applications
      WHERE id = v_application_id AND status = 'under_review'
    ) THEN
      RAISE EXCEPTION 'Legacy submitted status was not normalized to under_review.';
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'PZ071', MESSAGE = 'rollback onboarding status normalization proof';
  EXCEPTION WHEN SQLSTATE 'PZ071' THEN
    NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.onboarding_applications
    WHERE id = v_application_id AND status::text = v_original_status
  ) THEN
    RAISE EXCEPTION 'Onboarding status normalization proof did not roll back cleanly.';
  END IF;
END;
$$;

COMMIT;
