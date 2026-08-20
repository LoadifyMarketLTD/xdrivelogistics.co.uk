-- PreLive P1 finance authority closure.
--
-- The +15 day exceptional payment extension is a financial governance action.
-- An active owner/admin/finance membership is not sufficient by itself: the
-- invoice company must also be operationally active. This closes the edge case
-- where a membership remains active while the company is pending/suspended.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.extend_invoice_due_date_special(
  p_invoice_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
RETURNS TABLE (
  invoice_id uuid,
  payment_terms text,
  payment_extension_days smallint,
  due_date date,
  payment_extended_at timestamptz,
  payment_extended_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_role text;
  v_company_status text;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Finance actor is required.' USING ERRCODE = '42501';
  END IF;

  IF length(v_reason) < 10 THEN
    RAISE EXCEPTION 'A specific reason of at least 10 characters is required for the special payment extension.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    cm.role_in_company::text,
    c.status::text
  INTO
    v_role,
    v_company_status
  FROM public.company_memberships cm
  JOIN public.companies c
    ON c.id = cm.company_id
  WHERE cm.company_id = v_invoice.company_id
    AND cm.user_id = p_actor_user_id
    AND COALESCE(cm.status::text, '') = 'active'
  LIMIT 1;

  IF COALESCE(v_company_status, '') <> 'active' THEN
    RAISE EXCEPTION 'An active company is required to grant a payment extension.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_role, '') NOT IN ('owner', 'admin', 'finance') THEN
    RAISE EXCEPTION 'Owner, admin or finance role is required to grant a payment extension.'
      USING ERRCODE = '42501';
  END IF;

  IF lower(COALESCE(v_invoice.status::text, '')) IN ('paid', 'cancelled')
     OR lower(COALESCE(v_invoice.payment_status::text, '')) = 'paid' THEN
    RAISE EXCEPTION 'Paid or cancelled invoices cannot receive a payment extension.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(v_invoice.payment_extension_days, 0) = 15 THEN
    RAISE EXCEPTION 'This invoice already has the maximum +15 day payment extension.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.invoices i
  SET payment_extension_days = 15,
      payment_extension_reason = v_reason,
      payment_extended_at = now(),
      payment_extended_by = p_actor_user_id,
      due_date = i.invoice_date
        + (public.fn_xdrive_payment_due_days(i.payment_terms) + 15),
      updated_at = now()
  WHERE i.id = p_invoice_id;

  RETURN QUERY
  SELECT
    i.id,
    i.payment_terms,
    i.payment_extension_days,
    i.due_date,
    i.payment_extended_at,
    i.payment_extended_by
  FROM public.invoices i
  WHERE i.id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.extend_invoice_due_date_special(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_invoice_due_date_special(uuid, uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.extend_invoice_due_date_special(uuid, uuid, text) IS
  'Service-only +15 day XDrive payment exception. Requires an active invoice company plus an active owner/admin/finance membership, one extension maximum, and an audited reason.';

NOTIFY pgrst, 'reload schema';
COMMIT;
