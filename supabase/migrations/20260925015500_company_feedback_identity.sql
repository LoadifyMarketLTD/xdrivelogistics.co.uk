BEGIN;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewer_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reviews_reviewer_company_id_idx
  ON public.reviews(reviewer_company_id);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_job_reviewer_company_unique
  ON public.reviews(job_id, reviewer_company_id)
  WHERE job_id IS NOT NULL AND reviewer_company_id IS NOT NULL;

DROP POLICY IF EXISTS reviews_select_participant_or_company_operator ON public.reviews;
CREATE POLICY reviews_select_participant_or_company_operator
  ON public.reviews FOR SELECT TO authenticated
  USING (
    reviewer_user_id = auth.uid()
    OR reviewed_user_id = auth.uid()
    OR (company_id IS NOT NULL AND public.is_company_non_driver(company_id))
    OR (reviewer_company_id IS NOT NULL AND public.is_company_non_driver(reviewer_company_id))
  );

COMMENT ON COLUMN public.reviews.reviewer_company_id IS
  'Company represented by the reviewer for company-level booking feedback; target company remains reviews.company_id.';

COMMIT;
