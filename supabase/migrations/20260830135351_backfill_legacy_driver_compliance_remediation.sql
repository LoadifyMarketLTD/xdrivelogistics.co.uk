BEGIN;

-- Create a canonical, non-approved onboarding/remediation record for legacy
-- Driver identities that predate the canonical identity/onboarding contract.
-- This migration deliberately DOES NOT activate identities, approve evidence,
-- alter driver/profile/membership status, or change app/commercial access.
INSERT INTO public.onboarding_applications (
  user_id,
  company_id,
  account_type,
  workspace_mode,
  owner_driver_workspace,
  status,
  email,
  current_step,
  completion_percentage,
  submitted_at,
  last_activity_at,
  payload,
  risk_status,
  created_at,
  updated_at
)
SELECT
  d.user_id,
  d.company_id,
  CASE
    WHEN lower(coalesce(d.driver_type, '')) = 'owner_driver' THEN 'owner_driver'
    ELSE 'individual_driver'
  END,
  CASE
    WHEN lower(coalesce(d.driver_type, '')) = 'owner_driver' THEN 'owner_driver'
    ELSE 'company_driver'
  END,
  lower(coalesce(d.driver_type, '')) = 'owner_driver',
  'under_review',
  au.email,
  'compliance_remediation',
  0,
  now(),
  now(),
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_driver_compliance_remediation', true,
    'canonical_account_type', CASE
      WHEN lower(coalesce(d.driver_type, '')) = 'owner_driver' THEN 'owner_driver'
      ELSE 'company_driver'
    END,
    'legacy_driver_id', d.id,
    'full_name', coalesce(nullif(trim(d.display_name), ''), nullif(trim(d.full_name), ''), nullif(trim(d.name), '')),
    'phone', nullif(trim(d.phone), ''),
    'email', au.email,
    'existing_company_id', d.company_id,
    'remediation_reason', 'legacy_driver_missing_canonical_identity_onboarding'
  )),
  'clear',
  now(),
  now()
FROM public.drivers d
JOIN auth.users au ON au.id = d.user_id
WHERE d.user_id IS NOT NULL
  AND d.company_id IS NOT NULL
  AND lower(coalesce(d.driver_type, '')) IN ('owner_driver', 'company_driver')
  AND NOT EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.user_id = d.user_id
  )
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
