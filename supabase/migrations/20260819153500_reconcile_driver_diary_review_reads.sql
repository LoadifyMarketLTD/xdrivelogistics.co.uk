-- Reconcile Driver Diary review reads from the effective live contract without
-- importing PR #359 UI or migration history.
--
-- Fresh history still leaves reviews_select_member, which lets every company
-- member read every company review. Live history has accumulated overlapping
-- participant/non-driver policies instead. Collapse both shapes to one policy:
-- reviewer, reviewed user, or authorised non-driver company operator.
--
-- This migration changes SELECT only. Review writes and Workspace UI are not
-- modified. job_documents keeps its existing creator/operator/assigned-driver
-- RLS and the separate authenticated SELECT grant migration remains authoritative.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS reviews_select_member ON public.reviews;
DROP POLICY IF EXISTS reviews_select_participant_or_company_operator ON public.reviews;
DROP POLICY IF EXISTS reviews_select_participant_or_non_driver ON public.reviews;

CREATE POLICY reviews_select_participant_or_company_operator
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (
    reviewer_user_id = auth.uid()
    OR reviewed_user_id = auth.uid()
    OR (
      company_id IS NOT NULL
      AND public.is_company_non_driver(company_id)
    )
  );

GRANT SELECT ON TABLE public.reviews TO authenticated;

-- Historical remote states carried a profile-role owner policy on job documents.
-- The current contract is job-scoped; remove that broad legacy alias if present.
DROP POLICY IF EXISTS owner_select_all_job_documents ON public.job_documents;

COMMENT ON POLICY reviews_select_participant_or_company_operator ON public.reviews IS
  'Reviews are readable by the reviewer, reviewed user, or authorised non-driver operators of the owning company. Drivers cannot browse unrelated company feedback.';

COMMIT;
