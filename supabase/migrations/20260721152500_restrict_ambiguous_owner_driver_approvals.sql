-- An existing owner-driver must not gain application access merely because a
-- legacy row was labelled approved while the recorded onboarding journey was
-- incomplete. Use the pre-reconciliation snapshot created by the immediately
-- preceding migration to preserve evidence of the original state.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

WITH ambiguous_approvals AS (
  SELECT
    s.user_id,
    greatest(
      5,
      least(
        95,
        coalesce(nullif(s.onboarding_row->>'completion_percentage', '')::numeric, 40)
      )
    ) AS original_completion
  FROM public.account_reconciliation_20260721_snapshot s
  WHERE lower(coalesce(s.onboarding_row->>'account_type', '')) = 'owner_driver'
    AND lower(coalesce(s.onboarding_row->>'status', '')) = 'approved'
    AND (
      coalesce(nullif(s.onboarding_row->>'completion_percentage', '')::numeric, 0) < 100
      OR lower(coalesce(s.onboarding_row->>'current_step', '')) <> 'workspace_unlocked'
    )
)
UPDATE public.onboarding_applications oa
SET status = 'in_progress',
    current_step = 'identity_documents',
    completion_percentage = a.original_completion,
    reviewed_at = NULL,
    reviewed_by = NULL,
    review_notes = concat_ws(
      E'\n',
      nullif(oa.review_notes, ''),
      'Legacy approval was restricted because the captured onboarding record was incomplete.'
    ),
    payload = coalesce(oa.payload, '{}'::jsonb) || jsonb_build_object(
      'legacy_approval_restricted_at', now(),
      'legacy_approval_restriction_source', '20260721152500'
    ),
    last_activity_at = now(),
    updated_at = now()
FROM ambiguous_approvals a
WHERE oa.user_id = a.user_id
  AND oa.account_type = 'owner_driver';

UPDATE public.drivers d
SET app_access = false,
    updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.account_reconciliation_20260721_snapshot s
  WHERE s.user_id = d.user_id
    AND lower(coalesce(s.onboarding_row->>'account_type', '')) = 'owner_driver'
    AND lower(coalesce(s.onboarding_row->>'status', '')) = 'approved'
    AND (
      coalesce(nullif(s.onboarding_row->>'completion_percentage', '')::numeric, 0) < 100
      OR lower(coalesce(s.onboarding_row->>'current_step', '')) <> 'workspace_unlocked'
    )
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.account_reconciliation_20260721_snapshot s
    JOIN public.onboarding_applications oa ON oa.user_id = s.user_id
    LEFT JOIN public.drivers d ON d.user_id = s.user_id
    WHERE lower(coalesce(s.onboarding_row->>'account_type', '')) = 'owner_driver'
      AND lower(coalesce(s.onboarding_row->>'status', '')) = 'approved'
      AND (
        coalesce(nullif(s.onboarding_row->>'completion_percentage', '')::numeric, 0) < 100
        OR lower(coalesce(s.onboarding_row->>'current_step', '')) <> 'workspace_unlocked'
      )
      AND (
        oa.status <> 'in_progress'
        OR oa.current_step <> 'identity_documents'
        OR coalesce(d.app_access, false) = true
      )
  ) THEN
    RAISE EXCEPTION 'Ambiguous owner-driver approval restriction failed.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
