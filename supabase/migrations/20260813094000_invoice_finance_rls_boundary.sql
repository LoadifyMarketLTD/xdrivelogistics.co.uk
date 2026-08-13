-- Invoice/finance RLS boundary hardening
--
-- Canonical XDrive rules:
-- - Owner Driver has the same finance rights as Fleet Owner/Admin/Finance.
-- - Fleet Driver has no Finance / invoice write access.
-- - Bill-to Customer/Broker may view an invoice when their company is the explicit buyer,
--   but may not edit issuer finance records.
-- - Invoice items are editable only while the invoice remains Draft/Pending.
-- - Payment history is append-only for issuer finance managers.
--
-- This migration removes permissive member-wide finance policies. It does not touch
-- Super Admin UI or grant a global cross-tenant owner bypass.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Role helpers based on active company membership, never profile.role.
--    This deliberately keeps Owner Driver eligible when their profile role is driver.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_company_finance(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      JOIN public.companies c ON c.id = cm.company_id
      WHERE cm.company_id = p_company_id
        AND cm.user_id = auth.uid()
        AND lower(coalesce(cm.status, 'active')) = 'active'
        AND lower(coalesce(cm.role_in_company, '')) IN ('owner', 'admin', 'finance')
        AND lower(coalesce(c.status::text, 'active')) = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_bill_to_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      JOIN public.companies c ON c.id = cm.company_id
      WHERE cm.company_id = p_company_id
        AND cm.user_id = auth.uid()
        AND lower(coalesce(cm.status, 'active')) = 'active'
        AND lower(coalesce(cm.role_in_company, '')) <> 'driver'
        AND lower(coalesce(c.status::text, 'active')) = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_invoice(p_invoice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = p_invoice_id
      AND public.can_manage_company_finance(i.company_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_invoice(p_invoice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = p_invoice_id
      AND public.can_manage_company_finance(i.company_id)
      AND lower(i.status::text) IN ('draft', 'pending')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_invoice(p_invoice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = p_invoice_id
      AND (
        public.can_manage_company_finance(i.company_id)
        OR (
          i.buyer_company_id IS NOT NULL
          AND public.can_view_bill_to_company(i.buyer_company_id)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_company_finance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_bill_to_company(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_invoice(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_company_finance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_bill_to_company(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_invoice(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_invoice(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_invoice(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Invoices: issuer finance managers write; explicit bill-to company reads only.
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_delete_creator_or_admin ON public.invoices;
DROP POLICY IF EXISTS invoices_delete_member ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_authenticated ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_member ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_operator ON public.invoices;
DROP POLICY IF EXISTS invoices_job_owner_read ON public.invoices;
DROP POLICY IF EXISTS invoices_select_authenticated ON public.invoices;
DROP POLICY IF EXISTS invoices_select_member ON public.invoices;
DROP POLICY IF EXISTS invoices_select_non_driver ON public.invoices;
DROP POLICY IF EXISTS invoices_update_authenticated ON public.invoices;
DROP POLICY IF EXISTS invoices_update_creator_or_admin ON public.invoices;
DROP POLICY IF EXISTS invoices_update_member ON public.invoices;
DROP POLICY IF EXISTS owner_select_all_invoices ON public.invoices;
DROP POLICY IF EXISTS invoices_select_finance_boundary_v3 ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_finance_boundary_v3 ON public.invoices;
DROP POLICY IF EXISTS invoices_update_finance_boundary_v3 ON public.invoices;
DROP POLICY IF EXISTS invoices_delete_finance_boundary_v3 ON public.invoices;

CREATE POLICY invoices_select_finance_boundary_v3
ON public.invoices
FOR SELECT TO authenticated
USING (
  public.can_manage_company_finance(company_id)
  OR (
    buyer_company_id IS NOT NULL
    AND public.can_view_bill_to_company(buyer_company_id)
  )
);

CREATE POLICY invoices_insert_finance_boundary_v3
ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_company_finance(company_id)
  AND (supplier_company_id IS NULL OR supplier_company_id = company_id)
  AND created_by = auth.uid()
);

CREATE POLICY invoices_update_finance_boundary_v3
ON public.invoices
FOR UPDATE TO authenticated
USING (public.can_manage_company_finance(company_id))
WITH CHECK (
  public.can_manage_company_finance(company_id)
  AND (supplier_company_id IS NULL OR supplier_company_id = company_id)
);

CREATE POLICY invoices_delete_finance_boundary_v3
ON public.invoices
FOR DELETE TO authenticated
USING (
  public.can_manage_company_finance(company_id)
  AND lower(status::text) IN ('draft', 'pending')
);

-- -----------------------------------------------------------------------------
-- 3. Invoice items: visibility follows invoice; writes only while editable.
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_items_delete_member ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_insert_member ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_select_member ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_update_member ON public.invoice_items;
DROP POLICY IF EXISTS owner_select_all_invoice_items ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_select_finance_boundary_v3 ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_insert_finance_boundary_v3 ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_update_finance_boundary_v3 ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_delete_finance_boundary_v3 ON public.invoice_items;

CREATE POLICY invoice_items_select_finance_boundary_v3
ON public.invoice_items
FOR SELECT TO authenticated
USING (public.can_view_invoice(invoice_id));

CREATE POLICY invoice_items_insert_finance_boundary_v3
ON public.invoice_items
FOR INSERT TO authenticated
WITH CHECK (
  company_id IS NOT NULL
  AND public.can_edit_invoice(invoice_id)
  AND EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND i.company_id = invoice_items.company_id
  )
);

CREATE POLICY invoice_items_update_finance_boundary_v3
ON public.invoice_items
FOR UPDATE TO authenticated
USING (public.can_edit_invoice(invoice_id))
WITH CHECK (
  company_id IS NOT NULL
  AND public.can_edit_invoice(invoice_id)
  AND EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
      AND i.company_id = invoice_items.company_id
  )
);

CREATE POLICY invoice_items_delete_finance_boundary_v3
ON public.invoice_items
FOR DELETE TO authenticated
USING (public.can_edit_invoice(invoice_id));

-- -----------------------------------------------------------------------------
-- 4. Invoice payment history: issuer finance read + append only.
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoice_payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_payment_history_insert ON public.invoice_payment_history;
DROP POLICY IF EXISTS invoice_payment_history_member_access ON public.invoice_payment_history;
DROP POLICY IF EXISTS invoice_payment_history_select ON public.invoice_payment_history;
DROP POLICY IF EXISTS owner_select_all_invoice_payment_history ON public.invoice_payment_history;
DROP POLICY IF EXISTS invoice_payment_history_select_finance_boundary_v3 ON public.invoice_payment_history;
DROP POLICY IF EXISTS invoice_payment_history_insert_finance_boundary_v3 ON public.invoice_payment_history;

CREATE POLICY invoice_payment_history_select_finance_boundary_v3
ON public.invoice_payment_history
FOR SELECT TO authenticated
USING (public.can_manage_invoice(invoice_id));

CREATE POLICY invoice_payment_history_insert_finance_boundary_v3
ON public.invoice_payment_history
FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_invoice(invoice_id)
  AND recorded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_payment_history.invoice_id
      AND i.company_id = invoice_payment_history.company_id
  )
);

-- -----------------------------------------------------------------------------
-- 5. Payments: no member-wide CRUD; issuer finance roles only.
-- -----------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_select_all_payments ON public.payments;
DROP POLICY IF EXISTS payments_delete_admin ON public.payments;
DROP POLICY IF EXISTS payments_delete_member ON public.payments;
DROP POLICY IF EXISTS payments_insert_admin ON public.payments;
DROP POLICY IF EXISTS payments_insert_member ON public.payments;
DROP POLICY IF EXISTS payments_select_member ON public.payments;
DROP POLICY IF EXISTS payments_select_non_driver ON public.payments;
DROP POLICY IF EXISTS payments_update_admin ON public.payments;
DROP POLICY IF EXISTS payments_update_member ON public.payments;
DROP POLICY IF EXISTS payments_select_finance_boundary_v3 ON public.payments;
DROP POLICY IF EXISTS payments_insert_finance_boundary_v3 ON public.payments;
DROP POLICY IF EXISTS payments_update_finance_boundary_v3 ON public.payments;
DROP POLICY IF EXISTS payments_delete_finance_boundary_v3 ON public.payments;

CREATE POLICY payments_select_finance_boundary_v3
ON public.payments
FOR SELECT TO authenticated
USING (public.can_manage_company_finance(company_id));

CREATE POLICY payments_insert_finance_boundary_v3
ON public.payments
FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_company_finance(company_id)
  AND created_by = auth.uid()
  AND (
    invoice_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = payments.invoice_id
        AND i.company_id = payments.company_id
        AND public.can_manage_invoice(i.id)
    )
  )
);

CREATE POLICY payments_update_finance_boundary_v3
ON public.payments
FOR UPDATE TO authenticated
USING (public.can_manage_company_finance(company_id))
WITH CHECK (
  public.can_manage_company_finance(company_id)
  AND (
    invoice_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = payments.invoice_id
        AND i.company_id = payments.company_id
        AND public.can_manage_invoice(i.id)
    )
  )
);

CREATE POLICY payments_delete_finance_boundary_v3
ON public.payments
FOR DELETE TO authenticated
USING (public.can_manage_company_finance(company_id));

COMMENT ON FUNCTION public.can_manage_company_finance(uuid) IS
  'Issuer finance boundary: active owner/admin/finance membership; profile.role is intentionally ignored so Owner Driver remains eligible.';
COMMENT ON FUNCTION public.can_view_bill_to_company(uuid) IS
  'Bill-to viewer boundary: active explicit buyer-company membership excluding Fleet Driver.';
COMMENT ON FUNCTION public.can_manage_invoice(uuid) IS
  'True only when the authenticated user may manage the invoice issuer company finance.';
COMMENT ON FUNCTION public.can_edit_invoice(uuid) IS
  'True only for issuer finance managers while invoice status is Draft/Pending.';
COMMENT ON FUNCTION public.can_view_invoice(uuid) IS
  'Invoice view boundary: issuer finance manager or active non-driver member of the explicit buyer company.';

NOTIFY pgrst, 'reload schema';

COMMIT;
