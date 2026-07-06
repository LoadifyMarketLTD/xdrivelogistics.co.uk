-- Restore company_documents runtime table.
--
-- Production drift left the table absent even though onboarding document upload
-- and fleet compliance submit paths write to public.company_documents.

CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  onboarding_application_id uuid REFERENCES public.onboarding_applications(id) ON DELETE SET NULL,
  doc_type text NOT NULL CHECK (
    doc_type IN (
      'operator_licence',
      'public_liability',
      'goods_in_transit',
      'vehicle_insurance',
      'motor_fleet_insurance',
      'vat_registration',
      'company_registration'
    )
  ),
  file_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'expired')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  expiry_date date,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_documents_company_idx
  ON public.company_documents (company_id);
CREATE INDEX IF NOT EXISTS company_documents_status_idx
  ON public.company_documents (status);
CREATE INDEX IF NOT EXISTS company_documents_onboarding_idx
  ON public.company_documents (onboarding_application_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at_company_documents()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_company_documents ON public.company_documents;
CREATE TRIGGER trg_touch_updated_at_company_documents
  BEFORE UPDATE ON public.company_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at_company_documents();

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO service_role;

DROP POLICY IF EXISTS company_documents_select_company_members ON public.company_documents;
DROP POLICY IF EXISTS company_documents_insert_company_operator ON public.company_documents;
DROP POLICY IF EXISTS company_documents_update_company_operator ON public.company_documents;
DROP POLICY IF EXISTS company_documents_delete_company_operator ON public.company_documents;

CREATE POLICY company_documents_select_company_members
  ON public.company_documents
  FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY company_documents_insert_company_operator
  ON public.company_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_operator(company_id));

CREATE POLICY company_documents_update_company_operator
  ON public.company_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_company_operator(company_id))
  WITH CHECK (public.is_company_operator(company_id));

CREATE POLICY company_documents_delete_company_operator
  ON public.company_documents
  FOR DELETE
  TO authenticated
  USING (public.is_company_operator(company_id));

NOTIFY pgrst, 'reload schema';
