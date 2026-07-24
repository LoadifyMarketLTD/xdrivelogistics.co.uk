-- P0 remediation: onboarding-documents storage policies + SECURITY DEFINER hardening
--
-- 1. Onboarding-documents storage policies (DEF-P0-4)
--    Bucket was created in migration 099 but no access policies were ever defined.
--    Path convention: onboarding-documents/{user_id}/{application_id}/{filename}
--
-- 2. SECURITY DEFINER function hardening (DEF-P0-6)
--    Re-create auth_company_id() and next_invoice_number() with explicit
--    SET search_path = public to prevent user-controlled object shadowing.
--
-- 3. pod-photos driver upload policy (P0-1 companion)
--    Runtime code uploads POD evidence to pod-photos/{job_id}/photos/{filename}
--    and pod-photos/{job_id}/documents/{filename}. The existing bucket policy
--    (migration 032) uses a company-id path prefix that does not match runtime
--    code. This additive policy covers the driver upload path used by the apps.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. onboarding-documents storage policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Applicants may upload files only into their own user path.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'onboarding_docs_insert_own_user'
  ) THEN
    CREATE POLICY "onboarding_docs_insert_own_user"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'onboarding-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Applicants may list and read only their own files.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'onboarding_docs_select_own_user'
  ) THEN
    CREATE POLICY "onboarding_docs_select_own_user"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'onboarding-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Applicants may replace only their own files (upsert support).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'onboarding_docs_update_own_user'
  ) THEN
    CREATE POLICY "onboarding_docs_update_own_user"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'onboarding-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'onboarding-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Reviewers (owner, company_admin, admin) may read all onboarding documents.
-- Uses service-role bypass in the review API; this policy covers any
-- authenticated reviewer reading via their own JWT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'onboarding_docs_select_reviewer'
  ) THEN
    CREATE POLICY "onboarding_docs_select_reviewer"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'onboarding-documents'
      AND (
        SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
      ) IN ('owner', 'company_admin')
    );
  END IF;
END $$;

-- Deny all other authenticated access (explicit deny via absence of matching policy).
-- Unauthenticated access is denied by bucket public = false.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pod-photos driver upload policy (job-id path convention)
--    Runtime path: pod-photos/{job_id}/photos/{filename}
--                  pod-photos/{job_id}/documents/{filename}
--    Driver must own the job (assigned_driver_id = authenticated driver id).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'pod_photos_insert_assigned_driver'
  ) THEN
    CREATE POLICY "pod_photos_insert_assigned_driver"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'pod-photos'
      AND EXISTS (
        SELECT 1
        FROM public.jobs j
        JOIN public.drivers d ON d.id = j.assigned_driver_id
        WHERE j.id::text = (storage.foldername(name))[1]
          AND d.user_id = auth.uid()
          AND d.app_access = true
      )
    );
  END IF;
END $$;

-- Assigned driver may read their own uploaded POD files.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'pod_photos_select_assigned_driver'
  ) THEN
    CREATE POLICY "pod_photos_select_assigned_driver"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'pod-photos'
      AND EXISTS (
        SELECT 1
        FROM public.jobs j
        JOIN public.drivers d ON d.id = j.assigned_driver_id
        WHERE j.id::text = (storage.foldername(name))[1]
          AND d.user_id = auth.uid()
          AND d.app_access = true
      )
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Harden SECURITY DEFINER functions with SET search_path (DEF-P0-6)
-- ─────────────────────────────────────────────────────────────────────────────

-- auth_company_id() — originally created in migration 032 without search_path.
CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id::uuid
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- next_invoice_number() — originally created in migration 043 without search_path.
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_count  int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

  v_prefix := 'INV-' || to_char(now(), 'YYYYMM') || '-';

  SELECT COUNT(*) + 1
    INTO v_count
    FROM public.invoices
   WHERE company_id = p_company_id
     AND invoice_number LIKE v_prefix || '%';

  RETURN v_prefix || lpad(v_count::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;

COMMENT ON FUNCTION public.auth_company_id() IS
  'Returns the authenticated user''s company_id from profiles. SECURITY DEFINER with safe search_path. (Hardened in P0 remediation)';

COMMENT ON FUNCTION public.next_invoice_number(uuid) IS
  'Generates the next sequential invoice number for a company. Uses advisory lock for concurrency safety. (Hardened in P0 remediation)';

NOTIFY pgrst, 'reload schema';

COMMIT;
