-- Keep the platform-owner company out of the generic "new transport buyer"
-- restriction used for external buyers. Production changes are audited through
-- fn_review_transport_buyer_risk; this makes fresh/reset environments converge.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = '5587a84f-de1f-4e35-9991-3a6857de477d'::uuid
  ) THEN
    INSERT INTO public.transport_buyer_risk_controls (
      company_id,
      risk_mode,
      max_active_commitments,
      max_outstanding_exposure_gbp
    )
    VALUES (
      '5587a84f-de1f-4e35-9991-3a6857de477d'::uuid,
      'cleared',
      10000,
      999999999
    )
    ON CONFLICT (company_id) DO NOTHING;
  END IF;
END
$$;
