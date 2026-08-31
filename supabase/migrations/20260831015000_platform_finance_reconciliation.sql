BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- SA-09: Platform Owner finance reconciliation does not create settlement
-- records and does not impersonate a tenant Finance user. It only verifies the
-- canonical invoice_payment_history ledger, repairs derived invoice settlement
-- state when needed, and records Platform Owner provenance.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS platform_finance_reconciliation_result text,
  ADD COLUMN IF NOT EXISTS platform_finance_reconciliation_note text,
  ADD COLUMN IF NOT EXISTS platform_finance_reconciled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_finance_reconciled_at timestamptz;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_platform_finance_reconciliation_result_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_platform_finance_reconciliation_result_check
  CHECK (
    platform_finance_reconciliation_result IS NULL
    OR platform_finance_reconciliation_result IN ('verified', 'corrected')
  );

CREATE INDEX IF NOT EXISTS idx_invoices_platform_finance_reconciled_at
  ON public.invoices(platform_finance_reconciled_at DESC)
  WHERE platform_finance_reconciled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.owner_reconcile_invoice_payment_status(
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_reason text
)
RETURNS TABLE (
  id uuid,
  invoice_number text,
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
  v_invoice_amount numeric(12,2);
  v_old_payment_status text;
  v_old_paid_at timestamptz;
  v_expected_payment_status public.invoice_payment_status;
  v_expected_paid_at timestamptz;
  v_ledger_paid_amount numeric(12,2) := 0;
  v_payment_count bigint := 0;
  v_changed boolean := false;
  v_result text;
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
    i.amount,
    i.payment_status::text,
    i.paid_at
  INTO
    v_company_id,
    v_invoice_number,
    v_invoice_amount,
    v_old_payment_status,
    v_old_paid_at
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
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
    AND ph.company_id = v_company_id;

  v_expected_payment_status := public.fn_calculate_invoice_payment_status(
    v_invoice_amount,
    v_ledger_paid_amount
  );

  IF v_expected_payment_status <> 'paid'::public.invoice_payment_status THEN
    v_expected_paid_at := NULL;
  END IF;

  v_changed :=
    COALESCE(v_old_payment_status, 'unpaid') <> v_expected_payment_status::text
    OR v_old_paid_at IS DISTINCT FROM v_expected_paid_at;
  v_result := CASE WHEN v_changed THEN 'corrected' ELSE 'verified' END;

  UPDATE public.invoices
  SET
    payment_status = v_expected_payment_status,
    paid_at = v_expected_paid_at,
    platform_finance_reconciliation_result = v_result,
    platform_finance_reconciliation_note = v_reason,
    platform_finance_reconciled_by = p_actor_user_id,
    platform_finance_reconciled_at = now(),
    updated_at = CASE WHEN v_changed THEN now() ELSE updated_at END
  WHERE public.invoices.id = p_invoice_id;

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
    jsonb_build_object(
      'invoice_amount', v_invoice_amount,
      'ledger_paid_amount', v_ledger_paid_amount,
      'payment_record_count', v_payment_count,
      'old_paid_at', v_old_paid_at,
      'expected_paid_at', v_expected_paid_at,
      'changed', v_changed,
      'authority', 'platform_owner',
      'source', 'invoice_payment_history'
    ),
    now()
  );

  RETURN QUERY
  SELECT
    i.id,
    i.invoice_number,
    v_old_payment_status,
    i.payment_status::text,
    i.amount,
    v_ledger_paid_amount,
    v_payment_count,
    v_changed,
    i.platform_finance_reconciliation_result,
    i.platform_finance_reconciled_at
  FROM public.invoices i
  WHERE i.id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_reconcile_invoice_payment_status(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_reconcile_invoice_payment_status(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
