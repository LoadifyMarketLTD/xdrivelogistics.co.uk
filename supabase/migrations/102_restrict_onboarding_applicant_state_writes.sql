-- P0 hardening: applicants may edit their draft payload, but may not directly
-- manipulate onboarding review/state fields from the client Supabase session.
--
-- Canonical state transitions remain server-side through:
-- - /api/onboarding/init
-- - /api/onboarding/*/session
-- - /api/onboarding/submit/*
-- - /api/super-admin/onboarding/[id]

DROP POLICY IF EXISTS onboarding_applications_owner_insert
  ON public.onboarding_applications;
DROP POLICY IF EXISTS onboarding_applications_owner_update
  ON public.onboarding_applications;

REVOKE INSERT ON public.onboarding_applications FROM authenticated;
REVOKE UPDATE ON public.onboarding_applications FROM authenticated;

GRANT INSERT (
  user_id,
  email,
  account_type,
  status,
  token_hash,
  token_expires_at,
  token_last_sent_at,
  token_activated_at,
  last_activity_at,
  current_step,
  completion_percentage,
  payload
) ON public.onboarding_applications TO authenticated;

GRANT UPDATE (
  token_activated_at,
  last_activity_at,
  current_step,
  completion_percentage,
  payload
) ON public.onboarding_applications TO authenticated;

CREATE POLICY onboarding_applications_owner_insert
  ON public.onboarding_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'in_progress')
    AND company_id IS NULL
    AND submitted_at IS NULL
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND review_notes IS NULL
  );

CREATE POLICY onboarding_applications_owner_update
  ON public.onboarding_applications
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status IN ('draft', 'in_progress', 'request_changes')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'in_progress', 'request_changes')
  );

