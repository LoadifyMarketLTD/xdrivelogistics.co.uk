BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Platform Owner finance reconciliation is isolated from tenant-visible invoices.
-- It verifies the canonical invoice_payment_history ledger and may repair only the
-- derived invoices.payment_status / invoices.paid_at fields when ledger integrity
-- is unambiguous. It never creates, edits, deletes or fabricates payment records.
CREATE TABLE IF NOT EXISTS public.platform_finance_reconciliations (
  invoice_id uuid PRIMARY KEY REFERENCES public.invoices(id) ON DELETE CASCADE,
  result text NOT NULL CHECK (result IN ('verified', 'corrected')),
  note text NOT NULL,
  reconciled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reconciled_at timestamptz NOT NULL DEFAULT now(),
  reconciliation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_finance_reconciliations_reconciled_by
  ON public.platform_finance_reconciliations(reconciled_by);

CREATE INDEX IF NOT EXISTS idx_platform_finance_reconciliations_result_reconciled_at
  ON public.platform_finance_reconciliations(result, reconciled_at DESC);

ALTER TABLE public.platform_finance_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_finance_reconciliations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_finance_reconciliations TO service_role;

CREATE OR REPLACE FUNCTION public.owner_reconcile_invoice_payment_status(
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_reason text
)
RETURNS TABLE (
  id uuid,
  invoice_number text,
  invoice_currency text,
  old_payment_status text,
  new_payment_status text,
  invoice_amount numeric,
  ledger_paid_amount numeric,
  payment_record_count bigint,
  changed boolean,
  reconciliation_result text,
  reconciled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_company_id uuid;
  v_invoice_number text;
  v_invoice_currency text;
  v_invoice_amount numeric(12,2);
  v_old_payment_status text;
  v_old_paid_at timestamptz;
  v_expected_payment_status public.invoice_payment_status;
  v_expected_paid_at timestamptz;
  v_ledger_paid_amount numeric(12,2) := 0;
  v_payment_count bigint := 0;
  v_company_mismatch_count bigint := 0;
  v_currency_mismatch_count bigint := 0;
  v_changed boolean := false;
  v_result text;
  v_snapshot jsonb;
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required for Platform finance reconciliation.' USING ERRCODE = '23502';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 5 THEN
    RAISE EXCEPTION 'A reconciliation reason of at least 5 characters is required.' USING ERRCODE = '23514';
  END IF;

  SELECT
    i.company_id,
    i.invoice_number,
    NULLIF(upper(btrim(i.currency)), ''),
    i.amount,
    i.payment_status::text,
    i.paid_at
  INTO
    v_company_id,
    v_invoice_number,
    v_invoice_currency,
    v_invoice_amount,
    v_old_payment_status,
    v_old_paid_at
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_invoice_currency IS NULL THEN
    RAISE EXCEPTION 'Invoice currency is blank; reconciliation refused.' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)
  INTO v_company_mismatch_count
  FROM public.invoice_payment_history ph
  WHERE ph.invoice_id = p_invoice_id
    AND ph.company_id IS DISTINCT FROM v_company_id;

  IF v_company_mismatch_count > 0 THEN
    RAISE EXCEPTION 'Payment ledger company mismatch detected; reconciliation refused.' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)
  INTO v_currency_mismatch_count
  FROM public.invoice_payment_history ph
  WHERE ph.invoice_id = p_invoice_id
    AND upper(btrim(ph.currency)) IS DISTINCT FROM v_invoice_currency;

  IF v_currency_mismatch_count > 0 THEN
    RAISE EXCEPTION 'Payment ledger currency mismatch detected; reconciliation refused.' USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(sum(ph.amount), 0),
    count(*),
    max(ph.paid_at)
  INTO
    v_ledger_paid_amount,
    v_payment_count,
    v_expected_paid_at
  FROM public.invoice_payment_history ph
  WHERE ph.invoice_id = p_invoice_id
    AND ph.company_id = v_company_id
    AND upper(btrim(ph.currency)) = v_invoice_currency;

  v_expected_payment_status := public.fn_calculate_invoice_payment_status(
    v_invoice_amount,
    v_ledger_paid_amount
  );

  IF v_expected_payment_status <> 'paid'::public.invoice_payment_status THEN
    v_expected_paid_at := NULL;
  END IF;

  v_changed :=
    v_old_payment_status IS DISTINCT FROM v_expected_payment_status::text
    OR v_old_paid_at IS DISTINCT FROM v_expected_paid_at;
  v_result := CASE WHEN v_changed THEN 'corrected' ELSE 'verified' END;

  IF v_changed THEN
    UPDATE public.invoices
    SET
      payment_status = v_expected_payment_status,
      paid_at = v_expected_paid_at,
      updated_at = now()
    WHERE public.invoices.id = p_invoice_id;
  END IF;

  v_snapshot := jsonb_build_object(
    'invoice_amount', v_invoice_amount,
    'invoice_currency', v_invoice_currency,
    'ledger_paid_amount', v_ledger_paid_amount,
    'payment_record_count', v_payment_count,
    'company_mismatch_count', v_company_mismatch_count,
    'currency_mismatch_count', v_currency_mismatch_count,
    'old_payment_status', v_old_payment_status,
    'expected_payment_status', v_expected_payment_status::text,
    'old_paid_at', v_old_paid_at,
    'expected_paid_at', v_expected_paid_at,
    'changed', v_changed,
    'authority', 'platform_owner',
    'source', 'invoice_payment_history'
  );

  INSERT INTO public.platform_finance_reconciliations (
    invoice_id,
    result,
    note,
    reconciled_by,
    reconciled_at,
    reconciliation_snapshot,
    created_at,
    updated_at
  )
  VALUES (
    p_invoice_id,
    v_result,
    v_reason,
    p_actor_user_id,
    now(),
    v_snapshot,
    now(),
    now()
  )
  ON CONFLICT (invoice_id) DO UPDATE
  SET
    result = EXCLUDED.result,
    note = EXCLUDED.note,
    reconciled_by = EXCLUDED.reconciled_by,
    reconciled_at = EXCLUDED.reconciled_at,
    reconciliation_snapshot = EXCLUDED.reconciliation_snapshot,
    updated_at = now();

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_id,
    target_name,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    metadata,
    created_at
  )
  VALUES (
    p_actor_user_id,
    'invoice',
    p_invoice_id,
    COALESCE(v_invoice_number, p_invoice_id::text),
    v_company_id,
    CASE
      WHEN v_changed THEN 'finance_invoice_reconciled'
      ELSE 'finance_invoice_reconciliation_verified'
    END,
    COALESCE(v_old_payment_status, 'unpaid'),
    v_expected_payment_status::text,
    v_reason,
    v_snapshot,
    now()
  );

  RETURN QUERY
  SELECT
    i.id,
    i.invoice_number,
    v_invoice_currency,
    v_old_payment_status,
    i.payment_status::text,
    i.amount,
    v_ledger_paid_amount,
    v_payment_count,
    v_changed,
    r.result,
    r.reconciled_at
  FROM public.invoices i
  JOIN public.platform_finance_reconciliations r ON r.invoice_id = i.id
  WHERE i.id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_reconcile_invoice_payment_status(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reconcile_invoice_payment_status(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
