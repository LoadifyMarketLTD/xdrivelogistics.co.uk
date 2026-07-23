-- Migration 043: Restore runtime-critical objects reported missing by validation.
-- Idempotent repair for:
--   - public.prevent_unsafe_driver_delete()
--   - trg_prevent_unsafe_driver_delete on public.drivers
--   - public.next_invoice_number(uuid)

BEGIN;

-- Canonicalize legacy job assignment references before reinstalling runtime trigger logic.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'driver_id'
  ) THEN
    UPDATE public.jobs
       SET assigned_driver_id = driver_id
     WHERE assigned_driver_id IS NULL
       AND driver_id IS NOT NULL;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.prevent_unsafe_driver_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(OLD.status, 'active') = 'active' THEN
    RAISE EXCEPTION 'Cannot hard delete an active driver. Deactivate the driver first.'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.assigned_driver_id = OLD.id
      AND (
        j.status IS NULL
        OR j.status::text NOT IN ('delivered', 'cancelled', 'disputed')
      )
  ) THEN
    RAISE EXCEPTION 'Cannot hard delete a driver allocated to an open or active job.'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN OLD;
END;
$$;

-- Keep the canonical parameter name introduced by migration 014. PostgreSQL
-- rejects CREATE OR REPLACE when a later definition attempts to rename an
-- existing input parameter, even when the argument type is unchanged.
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix text;
  v_count int;
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

COMMIT;
