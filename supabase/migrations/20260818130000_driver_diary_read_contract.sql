-- Restore Driver Diary detail reads without opening feedback/documents globally.
-- RLS remains authoritative; this migration only activates SELECT after removing
-- legacy owner/member policies that were too broad for authenticated drivers.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS reviews_select_member ON public.reviews;
CREATE POLICY reviews_select_participant_or_company_operator
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (
    reviewer_user_id = auth.uid()
    OR reviewed_user_id = auth.uid()
    OR public.is_company_non_driver(company_id)
  );

GRANT SELECT ON TABLE public.reviews TO authenticated;

-- This old policy used profiles.role='owner' through is_owner(), which is not a
-- platform-super-admin discriminator. Keep job documents scoped to the existing
-- job creator/operator/assigned-driver policies instead.
DROP POLICY IF EXISTS owner_select_all_job_documents ON public.job_documents;
GRANT SELECT ON TABLE public.job_documents TO authenticated;

COMMENT ON POLICY reviews_select_participant_or_company_operator ON public.reviews IS
  'Feedback is visible to its reviewer/reviewed user and authorised non-driver operators of the owning company; company drivers cannot browse unrelated member feedback.';

COMMIT;
