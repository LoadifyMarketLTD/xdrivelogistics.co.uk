-- P1-002: applicants may view their owner-driver onboarding evidence, but may
-- only mutate vehicle/document evidence while the application is editable.

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
