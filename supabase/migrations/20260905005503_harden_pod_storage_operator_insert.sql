-- Hosted migration-history reconciliation alias.
-- Production recorded harden_pod_storage_operator_insert at 20260905005503 while
-- the canonical repository migration is 20260904230000. Fresh replay executes
-- the canonical policy migration first; this file verifies the hosted-version
-- effect without duplicating policy creation.

BEGIN;

DO $$
DECLARE
  v_check text;
BEGIN
  SELECT with_check
  INTO v_check
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'pod_photos_insert_operator_for_accessible_job';

  IF v_check IS NULL
     OR v_check NOT ILIKE '%is_company_operator%'
     OR v_check NOT ILIKE '%pod-photos%' THEN
    RAISE EXCEPTION 'POD operator upload policy hosted-version convergence failed.';
  END IF;
END;
$$;

COMMIT;
