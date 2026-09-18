-- Restore the canonical invoice payment trigger function after hosted schema drift.
-- This does not change RLS, enums, tables, or trigger wiring.
CREATE OR REPLACE FUNCTION public.fn_apply_invoice_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_amount numeric(12,2);
  v_total_paid numeric(12,2);
  v_payment_status public.invoice_payment_status;
  v_paid_at timestamptz;
BEGIN
  SELECT amount
  INTO v_invoice_amount
  FROM public.invoices
  WHERE id = NEW.invoice_id
    AND company_id = NEW.company_id
  FOR UPDATE;

  IF v_invoice_amount IS NULL THEN
    RAISE EXCEPTION 'Invoice % not found for company %', NEW.invoice_id, NEW.company_id;
  END IF;

  SELECT
    COALESCE(sum(amount), 0),
    max(paid_at)
  INTO
    v_total_paid,
    v_paid_at
  FROM public.invoice_payment_history
  WHERE invoice_id = NEW.invoice_id
    AND company_id = NEW.company_id;

  v_payment_status := public.fn_calculate_invoice_payment_status(v_invoice_amount, v_total_paid);

  UPDATE public.invoices
  SET
    payment_status = v_payment_status,
    paid_at = CASE
      WHEN v_payment_status = 'paid'::public.invoice_payment_status THEN COALESCE(v_paid_at, NEW.paid_at, now())
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = NEW.invoice_id
    AND company_id = NEW.company_id;

  RETURN NEW;
END;
$$;
