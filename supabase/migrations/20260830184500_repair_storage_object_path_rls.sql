BEGIN;

-- P0-06: repair Storage RLS policies that accidentally parsed the Driver name
-- (`d.name`) as if it were the Storage object path. Canonical path contracts:
--   load-documents/{company_id}/{job_id}/{filename}
--   pod-photos/{carrier_company_id}/{job_id}/{category}/{filename}
--   vehicle-docs/{company_id}/{vehicle_id}/{filename}
-- Every path comparison below therefore uses storage.objects.name.

DROP POLICY IF EXISTS "load_documents_select_creator_operator_or_driver" ON storage.objects;
CREATE POLICY "load_documents_select_creator_operator_or_driver"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'load-documents'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    LEFT JOIN public.drivers d ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[2]
      AND j.company_id::text = (storage.foldername(name))[1]
      AND (
        j.created_by = auth.uid()
        OR public.is_company_non_driver(j.company_id)
        OR (d.user_id = auth.uid() AND d.app_access = true)
      )
  )
);

DROP POLICY IF EXISTS "vehicle_docs_insert_assigned_driver" ON storage.objects;
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
      AND d.company_id = v.company_id
      AND v.company_id::text = (storage.foldername(name))[1]
      AND v.id::text = (storage.foldername(name))[2]
  )
);

DROP POLICY IF EXISTS "vehicle_docs_select_assigned_driver" ON storage.objects;
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
      AND d.company_id = v.company_id
      AND v.company_id::text = (storage.foldername(name))[1]
      AND v.id::text = (storage.foldername(name))[2]
  )
);

-- The original pod_photos_insert_driver policy only checked the company prefix,
-- allowing any app-enabled Driver in that company to target another job path.
-- Tighten it to the exact assigned job while repairing the path contract.
DROP POLICY IF EXISTS "pod_photos_insert_driver" ON storage.objects;
CREATE POLICY "pod_photos_insert_driver"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pod-photos'
  AND (storage.foldername(name))[1] = public.auth_company_id()::text
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.drivers d ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[2]
      AND d.user_id = auth.uid()
      AND d.app_access = true
      AND d.company_id = public.auth_company_id()
      AND (
        j.company_id = d.company_id
        OR j.assigned_company_id = d.company_id
        OR j.awarded_carrier_company_id = d.company_id
      )
  )
);

DROP POLICY IF EXISTS "pod_photos_insert_operator_for_accessible_job" ON storage.objects;
CREATE POLICY "pod_photos_insert_operator_for_accessible_job"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pod-photos'
  AND (storage.foldername(name))[1] = public.auth_company_id()::text
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    LEFT JOIN public.drivers d ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[2]
      AND (
        j.company_id = public.auth_company_id()
        OR j.assigned_company_id = public.auth_company_id()
        OR j.awarded_carrier_company_id = public.auth_company_id()
        OR (d.user_id = auth.uid() AND d.app_access = true AND d.company_id = public.auth_company_id())
      )
  )
);

DROP POLICY IF EXISTS "pod_photos_select_driver" ON storage.objects;
CREATE POLICY "pod_photos_select_driver"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pod-photos'
  AND (storage.foldername(name))[1] = public.auth_company_id()::text
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.drivers d ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[2]
      AND d.user_id = auth.uid()
      AND d.app_access = true
      AND d.company_id = public.auth_company_id()
  )
);

DROP POLICY IF EXISTS "pod_photos_select_job_owner_awarded_carrier_or_driver" ON storage.objects;
CREATE POLICY "pod_photos_select_job_owner_awarded_carrier_or_driver"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pod-photos'
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    LEFT JOIN public.drivers d ON d.id = j.assigned_driver_id
    WHERE j.id::text = (storage.foldername(name))[2]
      AND (storage.foldername(name))[1] IN (
        j.company_id::text,
        COALESCE(j.assigned_company_id::text, ''),
        COALESCE(j.awarded_carrier_company_id::text, '')
      )
      AND (
        j.created_by = auth.uid()
        OR j.company_id = public.auth_company_id()
        OR j.assigned_company_id = public.auth_company_id()
        OR j.awarded_carrier_company_id = public.auth_company_id()
        OR (d.user_id = auth.uid() AND d.app_access = true)
      )
  )
);

DO $$
DECLARE
  v_wrong integer;
  v_missing integer;
BEGIN
  SELECT count(*) INTO v_wrong
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND (
      COALESCE(qual, '') ILIKE '%storage.foldername(d.name)%'
      OR COALESCE(with_check, '') ILIKE '%storage.foldername(d.name)%'
    );

  IF v_wrong <> 0 THEN
    RAISE EXCEPTION 'Storage RLS still contains % Driver-name path parser(s).', v_wrong;
  END IF;

  SELECT count(*) INTO v_missing
  FROM (VALUES
    ('load_documents_select_creator_operator_or_driver'),
    ('vehicle_docs_insert_assigned_driver'),
    ('vehicle_docs_select_assigned_driver'),
    ('pod_photos_insert_driver'),
    ('pod_photos_insert_operator_for_accessible_job'),
    ('pod_photos_select_driver'),
    ('pod_photos_select_job_owner_awarded_carrier_or_driver')
  ) required(policyname)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'storage'
      AND p.tablename = 'objects'
      AND p.policyname = required.policyname
  );

  IF v_missing <> 0 THEN
    RAISE EXCEPTION 'Storage RLS repair is missing % required policy/policies.', v_missing;
  END IF;
END;
$$;

COMMIT;
