-- P1-002: applicants may view their owner-driver onboarding evidence, but may
-- only mutate vehicle/document evidence while the application is editable.

CREATE TABLE IF NOT EXISTS public.owner_driver_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_application_id uuid NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
  registration text NOT NULL,
  make text,
  model text,
  payload text,
  dimensions text,
  tail_lift boolean,
  insurance_details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS owner_driver_vehicles_onboarding_idx
  ON public.owner_driver_vehicles(onboarding_application_id);

CREATE TABLE IF NOT EXISTS public.driver_identity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_application_id uuid NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (
    doc_type IN (
      'driving_licence',
      'cpc',
      'proof_of_address',
      'right_to_work',
      'visa_document',
      'insurance'
    )
  ),
  file_path text,
  upload_status text NOT NULL DEFAULT 'missing' CHECK (upload_status IN ('missing', 'uploaded')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'under_review', 'verified', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_identity_documents_onboarding_idx
  ON public.driver_identity_documents(onboarding_application_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at_generic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_owner_driver_vehicles ON public.owner_driver_vehicles;
CREATE TRIGGER trg_touch_updated_at_owner_driver_vehicles
BEFORE UPDATE ON public.owner_driver_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_touch_updated_at_driver_identity_documents ON public.driver_identity_documents;
CREATE TRIGGER trg_touch_updated_at_driver_identity_documents
BEFORE UPDATE ON public.driver_identity_documents
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_generic();

ALTER TABLE public.owner_driver_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_identity_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_driver_vehicles_owner_access ON public.owner_driver_vehicles;
DROP POLICY IF EXISTS driver_identity_documents_owner_access ON public.driver_identity_documents;

CREATE POLICY owner_driver_vehicles_owner_select
  ON public.owner_driver_vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = owner_driver_vehicles.onboarding_application_id
        AND oa.user_id = auth.uid()
    )
  );

CREATE POLICY owner_driver_vehicles_owner_insert
  ON public.owner_driver_vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = owner_driver_vehicles.onboarding_application_id
        AND oa.user_id = auth.uid()
        AND oa.status IN ('draft', 'in_progress', 'request_changes')
    )
  );

CREATE POLICY owner_driver_vehicles_owner_update
  ON public.owner_driver_vehicles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = owner_driver_vehicles.onboarding_application_id
        AND oa.user_id = auth.uid()
        AND oa.status IN ('draft', 'in_progress', 'request_changes')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = owner_driver_vehicles.onboarding_application_id
        AND oa.user_id = auth.uid()
        AND oa.status IN ('draft', 'in_progress', 'request_changes')
    )
  );

CREATE POLICY owner_driver_vehicles_owner_delete
  ON public.owner_driver_vehicles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = owner_driver_vehicles.onboarding_application_id
        AND oa.user_id = auth.uid()
        AND oa.status IN ('draft', 'in_progress', 'request_changes')
    )
  );

CREATE POLICY driver_identity_documents_owner_select
  ON public.driver_identity_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = driver_identity_documents.onboarding_application_id
        AND oa.user_id = auth.uid()
    )
  );

CREATE POLICY driver_identity_documents_owner_insert
  ON public.driver_identity_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = driver_identity_documents.onboarding_application_id
        AND oa.user_id = auth.uid()
        AND oa.status IN ('draft', 'in_progress', 'request_changes')
    )
  );

CREATE POLICY driver_identity_documents_owner_update
  ON public.driver_identity_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = driver_identity_documents.onboarding_application_id
        AND oa.user_id = auth.uid()
        AND oa.status IN ('draft', 'in_progress', 'request_changes')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = driver_identity_documents.onboarding_application_id
        AND oa.user_id = auth.uid()
        AND oa.status IN ('draft', 'in_progress', 'request_changes')
    )
  );

CREATE POLICY driver_identity_documents_owner_delete
  ON public.driver_identity_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.id = driver_identity_documents.onboarding_application_id
        AND oa.user_id = auth.uid()
        AND oa.status IN ('draft', 'in_progress', 'request_changes')
    )
  );
