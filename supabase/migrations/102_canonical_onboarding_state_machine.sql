BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 102: Canonical onboarding state machine
--
-- Changes:
--   1. Add company_id to onboarding_applications (links onboarding → company at submit)
--   2. Migrate rows in dead status values before dropping the constraint
--   3. Replace status constraint — remove 'submitted', 'compliance_review',
--      'admin_approval'; add 'invited'
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Link onboarding application to the company created during submission
ALTER TABLE public.onboarding_applications
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS onboarding_applications_company_idx
  ON public.onboarding_applications(company_id);

-- 2. Migrate rows that are in dead status values
--    submitted / compliance_review / admin_approval → under_review
UPDATE public.onboarding_applications
   SET status = 'under_review'
 WHERE status IN ('submitted', 'compliance_review', 'admin_approval');

-- 3. Replace the status check constraint
--    Old (migration 099): draft | in_progress | submitted | under_review |
--                         compliance_review | admin_approval | approved |
--                         rejected | request_changes
--    New (canonical):     invited | draft | in_progress | under_review |
--                         request_changes | approved | rejected
ALTER TABLE public.onboarding_applications
  DROP CONSTRAINT IF EXISTS onboarding_applications_status_check;

ALTER TABLE public.onboarding_applications
  ADD CONSTRAINT onboarding_applications_status_check
  CHECK (status IN (
    'invited',
    'draft',
    'in_progress',
    'under_review',
    'request_changes',
    'approved',
    'rejected'
  ));

COMMIT;
