-- Driver workspace detail-read contract.
--
-- Repairs two live privilege gaps without broadening Marketplace/job visibility:
--   * assigned drivers may read job_documents only through the existing job-scoped RLS policies;
--   * reviews become readable to authenticated users, but drivers are restricted to feedback
--     they wrote or feedback written about them; non-driver company members retain the
--     existing company-operational review visibility.
--
-- No production rows are mutated. No lifecycle, quote, award, allocation or finance semantics change.

BEGIN;

GRANT SELECT ON TABLE public.job_documents TO authenticated;

GRANT SELECT ON TABLE public.reviews TO authenticated;

DROP POLICY IF EXISTS reviews_select_member ON public.reviews;
DROP POLICY IF EXISTS reviews_select_participant_or_non_driver ON public.reviews;

CREATE POLICY reviews_select_participant_or_non_driver
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

COMMENT ON POLICY reviews_select_participant_or_non_driver ON public.reviews IS
  'Authenticated review reads: drivers see reviews they authored or received; authorised non-driver company members retain company-operational review visibility.';

NOTIFY pgrst, 'reload schema';

COMMIT;
