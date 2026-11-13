-- FIN-03: invoice payment trigger must use the same net settlement formula
-- as refresh_invoice_stripe_balance. Reversal and lost-dispute amounts are
-- capped at the original Stripe attempt amount, avoiding double deduction.
-- This migration replaces only the function body; trigger wiring stays intact.
CREATE OR REPLACE FUNCTION public.fn_apply_invoice_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_amount numeric(12,2);
  v_gross_paid numeric(12,2);
  v_reversed numeric(12,2);
  v_net_paid numeric(12,2);
  v_payment_status public.invoice_payment_status;
  v_paid_at timestamptz;
BEGIN
  SELECT amount INTO v_invoice_amount
  FROM public.invoices
  WHERE id = NEW.invoice_id AND company_id = NEW.company_id
  FOR UPDATE;
  IF v_invoice_amount IS NULL THEN
    RAISE EXCEPTION 'Invoice % not found for company %', NEW.invoice_id, NEW.company_id;
  END IF;

  SELECT COALESCE(sum(amount), 0), max(paid_at)
  INTO v_gross_paid, v_paid_at
  FROM public.invoice_payment_history
  WHERE invoice_id = NEW.invoice_id AND company_id = NEW.company_id;

  SELECT COALESCE(sum(LEAST(a.amount_minor,
    COALESCE((SELECT sum(r.amount_minor) FROM public.invoice_stripe_reversals r
      WHERE r.attempt_id = a.id), 0) +
    COALESCE((SELECT sum(d.amount_minor) FROM public.invoice_stripe_disputes d
      WHERE d.attempt_id = a.id AND d.status = 'lost'), 0)
  )), 0) / 100.0
  INTO v_reversed
  FROM public.invoice_stripe_attempts a
  WHERE a.invoice_id = NEW.invoice_id;

  v_net_paid := GREATEST(0, v_gross_paid - v_reversed);
  v_payment_status := public.fn_calculate_invoice_payment_status(v_invoice_amount, v_net_paid);

  UPDATE public.invoices
  SET payment_status = v_payment_status,
      paid_at = CASE WHEN v_payment_status = 'paid'::public.invoice_payment_status
        THEN COALESCE(v_paid_at, NEW.paid_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = NEW.invoice_id AND company_id = NEW.company_id;

  RETURN NEW;
END;
$$;
