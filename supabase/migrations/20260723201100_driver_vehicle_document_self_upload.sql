-- Allow assigned drivers to upload documents for their vehicle.
-- Path convention: vehicle-docs/{company_id}/{vehicle_id}/{filename}

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'vehicle_docs_insert_assigned_driver'
  ) THEN
    CREATE POLICY "vehicle_docs_insert_assigned_driver"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'vehicle-docs'
      AND EXISTS (
        SELECT 1
        FROM public.vehicles v
        JOIN public.drivers d ON d.id = v.assigned_driver_id
        WHERE d.user_id = auth.uid()
          AND d.app_access = true
          AND v.company_id::text = (storage.foldername(name))[1]
          AND v.id::text = (storage.foldername(name))[2]
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'vehicle_docs_select_assigned_driver'
  ) THEN
    CREATE POLICY "vehicle_docs_select_assigned_driver"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'vehicle-docs'
      AND EXISTS (
        SELECT 1
        FROM public.vehicles v
        JOIN public.drivers d ON d.id = v.assigned_driver_id
        WHERE d.user_id = auth.uid()
          AND d.app_access = true
          AND v.company_id::text = (storage.foldername(name))[1]
          AND v.id::text = (storage.foldername(name))[2]
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vehicle_documents'
      AND policyname = 'vehicle_docs_insert_assigned_driver'
  ) THEN
    CREATE POLICY "vehicle_docs_insert_assigned_driver"
    ON public.vehicle_documents FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.vehicles v
        JOIN public.drivers d ON d.id = v.assigned_driver_id
        WHERE d.user_id = auth.uid()
          AND d.app_access = true
          AND v.id = vehicle_documents.vehicle_id
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vehicle_documents'
      AND policyname = 'vehicle_docs_select_assigned_driver'
  ) THEN
    CREATE POLICY "vehicle_docs_select_assigned_driver"
    ON public.vehicle_documents FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.vehicles v
        JOIN public.drivers d ON d.id = v.assigned_driver_id
        WHERE d.user_id = auth.uid()
          AND d.app_access = true
          AND v.id = vehicle_documents.vehicle_id
      )
    );
  END IF;
END $$;

COMMIT;
