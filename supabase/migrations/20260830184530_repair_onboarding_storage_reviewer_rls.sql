BEGIN;

-- P0-06 companion: a legacy catch-all Storage SELECT policy directly queried
-- restricted onboarding evidence tables. Because `authenticated` intentionally
-- has no SELECT privilege on those tables, PostgreSQL rejected otherwise valid
-- storage.objects reads before bucket-specific RLS could succeed. Preserve the
-- intended reviewer access through a narrow SECURITY DEFINER predicate instead
-- of granting raw table access.

CREATE OR REPLACE FUNCTION public.can_review_onboarding_storage_object(
  p_bucket_id text,
  p_object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('owner', 'admin')
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.driver_identity_documents d
        WHERE d.file_path IS NOT NULL
          AND d.file_path <> ''
          AND (
            d.file_path = p_object_name
            OR d.file_path = p_bucket_id || '/' || p_object_name
            OR d.file_path LIKE '%' || p_object_name
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.company_documents c
        WHERE c.file_path IS NOT NULL
          AND c.file_path <> ''
          AND (
            c.file_path = p_object_name
            OR c.file_path = p_bucket_id || '/' || p_object_name
            OR c.file_path LIKE '%' || p_object_name
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_review_onboarding_storage_object(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_review_onboarding_storage_object(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_review_onboarding_storage_object(text, text) TO authenticated;

DROP POLICY IF EXISTS "reviewers_read_onboarding_storage_objects" ON storage.objects;
CREATE POLICY "reviewers_read_onboarding_storage_objects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  public.can_review_onboarding_storage_object(bucket_id, name)
);

DO $$
DECLARE
  v_expr text;
BEGIN
  IF has_table_privilege('authenticated', 'public.driver_identity_documents', 'SELECT')
     OR has_table_privilege('authenticated', 'public.company_documents', 'SELECT') THEN
    RAISE EXCEPTION 'P0-06 must not grant authenticated raw onboarding evidence table access.';
  END IF;

  SELECT qual INTO v_expr
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'reviewers_read_onboarding_storage_objects';

  IF v_expr IS NULL OR v_expr NOT ILIKE '%can_review_onboarding_storage_object%' THEN
    RAISE EXCEPTION 'Reviewer Storage policy is not using the protected helper.';
  END IF;

  IF v_expr ILIKE '%driver_identity_documents%'
     OR v_expr ILIKE '%company_documents%' THEN
    RAISE EXCEPTION 'Reviewer Storage policy still directly references restricted evidence tables.';
  END IF;
END;
$$;

COMMIT;
