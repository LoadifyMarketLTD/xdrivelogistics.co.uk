-- Real-database regression checks for the XDrive payment-term contract.
-- Run after all migrations on a disposable/local/staging database.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
END;
$$;

SELECT pg_temp.assert_true(
  public.fn_canonical_xdrive_payment_terms('due on receipt') = 'Pay now',
  'Due on receipt no longer canonicalises to Pay now.'
);
SELECT pg_temp.assert_true(
  public.fn_xdrive_payment_due_days('Pay now') = 0,
  'Pay now must be due immediately.'
);
SELECT pg_temp.assert_true(
  public.fn_xdrive_payment_due_days('14 days') = 14,
  '14-day payment term is incorrect.'
);
SELECT pg_temp.assert_true(
  public.fn_xdrive_payment_due_days('30 days') = 30,
  '30-day payment term is incorrect.'
);

DO $$
BEGIN
  BEGIN
    PERFORM public.fn_canonical_xdrive_payment_terms('45 days');
    RAISE EXCEPTION '45-day base payment term was accepted.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM public.fn_canonical_xdrive_payment_terms('60 days');
    RAISE EXCEPTION '60-day base payment term was accepted.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$$;

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'payment_extension_days'
  ),
  'Invoice special-extension column is missing.'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'invoices'
      AND c.conname = 'invoices_payment_extension_days_check'
  ),
  'Invoice +15-day extension constraint is missing.'
);

SELECT pg_temp.assert_true(
  NOT has_function_privilege(
    'authenticated',
    'public.extend_invoice_due_date_special(uuid,uuid,text)',
    'EXECUTE'
  ),
  'Authenticated callers can bypass the controlled finance extension endpoint.'
);
SELECT pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.extend_invoice_due_date_special(uuid,uuid,text)',
    'EXECUTE'
  ),
  'Service role cannot execute the controlled finance extension RPC.'
);

-- The effective/latest RPC definition must require both an active membership and
-- an active invoice company. This is checked from the live function definition
-- produced by the full migration chain, not from a source-file string.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT lower(pg_get_functiondef(
    'public.extend_invoice_due_date_special(uuid,uuid,text)'::regprocedure
  ))
  INTO v_definition;

  PERFORM pg_temp.assert_true(
    position('join public.companies c' in v_definition) > 0,
    'Finance extension RPC no longer joins the invoice company authority boundary.'
  );
  PERFORM pg_temp.assert_true(
    position("coalesce(cm.status::text, '') = 'active'" in v_definition) > 0,
    'Finance extension RPC no longer requires an active finance membership.'
  );
  PERFORM pg_temp.assert_true(
    position("coalesce(v_company_status, '') <> 'active'" in v_definition) > 0,
    'Finance extension RPC no longer rejects pending/suspended companies.'
  );
END;
$$;

SELECT pass('XDrive payment-term and special-extension DB contract passed.');
SELECT * FROM finish();
ROLLBACK;
