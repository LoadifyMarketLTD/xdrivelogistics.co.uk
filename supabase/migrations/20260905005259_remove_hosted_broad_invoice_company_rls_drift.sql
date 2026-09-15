-- Hosted migration-history reconciliation alias.
-- Production recorded this RLS cleanup at 20260905005259 while the canonical
-- repository migration is 20260904223500. Fresh replay executes the canonical
-- cleanup first; this file verifies that none of the hosted broad policies remain.

BEGIN;

DO $$
DECLARE
  v_remaining integer;
BEGIN
  SELECT count(*)
  INTO v_remaining
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage')
    AND (
      (schemaname = 'public' AND tablename = 'invoices' AND policyname = ANY (ARRAY[
        'invoices_delete_member',
        'invoices_insert_authenticated',
        'invoices_insert_member',
        'invoices_select_authenticated',
        'invoices_select_member',
        'invoices_update_authenticated',
        'invoices_update_member'
      ]::text[]))
      OR (schemaname = 'public' AND tablename = 'companies' AND policyname = 'companies_update_member')
      OR (schemaname = 'public' AND tablename = 'jobs' AND policyname = ANY (ARRAY[
        'jobs_insert_authenticated',
        'jobs_update_authenticated'
      ]::text[]))
      OR (schemaname = 'public' AND tablename = 'vehicles' AND policyname = ANY (ARRAY[
        'vehicles_insert_authenticated',
        'vehicles_update_authenticated'
      ]::text[]))
      OR (schemaname = 'public' AND tablename = 'onboarding_applications' AND policyname = ANY (ARRAY[
        'onboarding_insert_own',
        'onboarding_update_own_limited'
      ]::text[]))
    );

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'Hosted broad RLS drift is not converged: % policies remain.', v_remaining;
  END IF;
END;
$$;

COMMIT;
