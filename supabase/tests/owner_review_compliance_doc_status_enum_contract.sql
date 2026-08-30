DO $$
DECLARE
  v_status_type text;
  v_function_def text;
BEGIN
  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
  INTO v_status_type
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'driver_documents'
    AND a.attname = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_status_type IS DISTINCT FROM 'doc_status' THEN
    RAISE EXCEPTION 'Expected public.driver_documents.status to use doc_status, got %', v_status_type;
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO v_function_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'owner_review_compliance_document'
  LIMIT 1;

  IF v_function_def IS NULL THEN
    RAISE EXCEPTION 'owner_review_compliance_document is missing';
  END IF;

  IF position('$2::public.doc_status' IN v_function_def) = 0 THEN
    RAISE EXCEPTION 'owner_review_compliance_document must cast Driver status writes to public.doc_status';
  END IF;

  IF position('SELECT %1$I::text' IN v_function_def) = 0 THEN
    RAISE EXCEPTION 'owner_review_compliance_document must cast polymorphic status reads to text';
  END IF;
END
$$;
