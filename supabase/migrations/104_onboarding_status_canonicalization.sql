BEGIN;

UPDATE public.onboarding_applications
SET status = 'under_review'
WHERE status IN ('submitted', 'compliance_review', 'admin_approval');

ALTER TABLE public.onboarding_applications
  DROP CONSTRAINT IF EXISTS onboarding_applications_status_check;

ALTER TABLE public.onboarding_applications
  ADD CONSTRAINT onboarding_applications_status_check
  CHECK (status IN ('draft', 'in_progress', 'under_review', 'approved', 'rejected', 'request_changes'));

COMMIT;
