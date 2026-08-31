BEGIN;

UPDATE public.onboarding_applications
SET status = 'under_review',
    current_step = 'compliance_remediation',
    updated_at = now()
WHERE COALESCE(payload->>'legacy_driver_compliance_remediation', 'false') = 'true'
  AND status = 'in_progress'
  AND risk_status = 'clear';

COMMIT;
