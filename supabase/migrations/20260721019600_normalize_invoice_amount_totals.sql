-- Preserve immutable commercial agreements while preventing a legacy zero
-- gross snapshot from creating an invalid zero-total invoice. The invoice row
-- is the derived document, so it may safely normalize its own arithmetic.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_normalize_invoice_amount_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_net numeric(12,2);
  v_vat numeric(12,2);
BEGIN
  v_net := round(COALESCE(NEW.net_amount, 0), 2);
  v_vat := round(COALESCE(NEW.vat_amount, 0), 2);

  IF v_net <= 0 AND COALESCE(NEW.amount, 0) > 0 THEN
    v_net := greatest(round(NEW.amount - v_vat, 2), 0);
    NEW.net_amount := v_net;
  END IF;

  IF v_net > 0 AND COALESCE(NEW.amount, 0) <= 0 THEN
    NEW.amount := round(v_net + v_vat, 2);
  END IF;

  IF COALESCE(NEW.amount, 0) < 0
     OR COALESCE(NEW.net_amount, 0) < 0
     OR COALESCE(NEW.vat_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Invoice amounts cannot be negative.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_invoice_amount_totals ON public.invoices;
CREATE TRIGGER trg_normalize_invoice_amount_totals
BEFORE INSERT OR UPDATE OF amount, net_amount, vat_amount
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_normalize_invoice_amount_totals();

COMMENT ON FUNCTION public.fn_normalize_invoice_amount_totals() IS
  'Ensures derived invoice total is positive and arithmetically consistent when a valid net amount exists.';

NOTIFY pgrst, 'reload schema';

COMMIT;
