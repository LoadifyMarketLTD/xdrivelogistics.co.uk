BEGIN;

-- P0-06 companion: invoice_docs_member_read directly queried invoice_documents,
-- which is intentionally not SELECT-granted to `authenticated`. That made any
-- authenticated storage.objects SELECT fail at policy planning time. Preserve
-- the same membership rule behind a narrow SECURITY DEFINER predicate.
--
-- Fresh Supabase projects inherit broad default table ACLs for anon/authenticated,
-- while hosted production has this evidence table restricted to postgres +
-- service_role. Reconstruct that hosted privilege boundary explicitly before the
-- policy verifier runs so clean replay does not depend on out-of-band ACL drift.
REVOKE ALL ON TABLE public.invoice_documents FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.invoice_documents TO service_role;

CREATE OR REPLACE FUNCTION public.can_read_invoice_storage_object(
  p_object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoice_documents d
    WHERE d.file_url = p_object_name
      AND public.is_company_member(d.company_id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_invoice_storage_object(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_invoice_storage_object(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_invoice_storage_object(text) TO authenticated;

DROP POLICY IF EXISTS "invoice_docs_member_read" ON storage.objects;
CREATE POLICY "invoice_docs_member_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-docs'
  AND public.can_read_invoice_storage_object(name)
);

DO $$
DECLARE
  v_expr text;
BEGIN
  IF has_table_privilege('authenticated', 'public.invoice_documents', 'SELECT')
     OR has_table_privilege('anon', 'public.invoice_documents', 'SELECT') THEN
    RAISE EXCEPTION 'P0-06 must not grant anon/authenticated raw invoice_documents access.';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.invoice_documents', 'SELECT') THEN
    RAISE EXCEPTION 'P0-06 must preserve service_role invoice_documents access.';
  END IF;

  SELECT qual INTO v_expr
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'invoice_docs_member_read';

  IF v_expr IS NULL OR v_expr NOT ILIKE '%can_read_invoice_storage_object%' THEN
    RAISE EXCEPTION 'Invoice Storage policy is not using the protected helper.';
  END IF;

  IF v_expr ILIKE '%invoice_documents%' THEN
    RAISE EXCEPTION 'Invoice Storage policy still directly references restricted invoice_documents.';
  END IF;
END;
$$;

COMMIT;
