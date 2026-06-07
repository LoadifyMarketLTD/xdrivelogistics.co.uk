-- ============================================================
-- Migration 090 — Fix is_company_member parameter name clash
-- ============================================================
-- Root cause: migration 042 (adaptive repair) detected no named
-- parameter and recreated the function with param "_company_id".
-- Subsequent migrations use CREATE OR REPLACE with param "cid",
-- which PostgreSQL rejects (cannot rename an input parameter via
-- CREATE OR REPLACE).
--
-- Fix: DROP ... CASCADE (removes function + all dependent RLS
-- policies), recreate the function with "cid", then recreate
-- every policy that was dropped.
-- ============================================================

-- ── Step 1: Drop function + all dependent RLS policies ───────────────────────
DROP FUNCTION IF EXISTS public.is_company_member(uuid) CASCADE;

-- ── Step 2: Recreate is_company_member with correct parameter name ────────────
CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND c.status::text = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;

-- ── Step 3: Recreate all RLS policies that depended on is_company_member ──────

-- audit_logs
DROP POLICY IF EXISTS audit_select_member ON public.audit_logs;
CREATE POLICY audit_select_member ON public.audit_logs
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS audit_insert_member ON public.audit_logs;
CREATE POLICY audit_insert_member ON public.audit_logs
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

-- drivers
DROP POLICY IF EXISTS drivers_select_member ON public.drivers;
CREATE POLICY drivers_select_member ON public.drivers
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS drivers_insert_member ON public.drivers;
CREATE POLICY drivers_insert_member ON public.drivers
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS drivers_update_member ON public.drivers;
CREATE POLICY drivers_update_member ON public.drivers
  FOR UPDATE USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS drivers_delete_member ON public.drivers;
CREATE POLICY drivers_delete_member ON public.drivers
  FOR DELETE USING (public.is_company_member(company_id));

-- invoices
DROP POLICY IF EXISTS invoices_select_member ON public.invoices;
CREATE POLICY invoices_select_member ON public.invoices
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS invoices_insert_member ON public.invoices;
CREATE POLICY invoices_insert_member ON public.invoices
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS invoices_update_member ON public.invoices;
CREATE POLICY invoices_update_member ON public.invoices
  FOR UPDATE USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS invoices_delete_member ON public.invoices;
CREATE POLICY invoices_delete_member ON public.invoices
  FOR DELETE USING (public.is_company_member(company_id));

-- invoice_items
DROP POLICY IF EXISTS invoice_items_select_member ON public.invoice_items;
CREATE POLICY invoice_items_select_member ON public.invoice_items
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS invoice_items_insert_member ON public.invoice_items;
CREATE POLICY invoice_items_insert_member ON public.invoice_items
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS invoice_items_update_member ON public.invoice_items;
CREATE POLICY invoice_items_update_member ON public.invoice_items
  FOR UPDATE USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS invoice_items_delete_member ON public.invoice_items;
CREATE POLICY invoice_items_delete_member ON public.invoice_items
  FOR DELETE USING (public.is_company_member(company_id));

-- payments
DROP POLICY IF EXISTS payments_select_member ON public.payments;
CREATE POLICY payments_select_member ON public.payments
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS payments_insert_member ON public.payments;
CREATE POLICY payments_insert_member ON public.payments
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS payments_update_member ON public.payments;
CREATE POLICY payments_update_member ON public.payments
  FOR UPDATE USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS payments_delete_member ON public.payments;
CREATE POLICY payments_delete_member ON public.payments
  FOR DELETE USING (public.is_company_member(company_id));

-- job_events
DROP POLICY IF EXISTS job_events_select_member ON public.job_events;
CREATE POLICY job_events_select_member ON public.job_events
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS job_events_insert_member ON public.job_events;
CREATE POLICY job_events_insert_member ON public.job_events
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS job_events_update_member ON public.job_events;
CREATE POLICY job_events_update_member ON public.job_events
  FOR UPDATE USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS job_events_delete_member ON public.job_events;
CREATE POLICY job_events_delete_member ON public.job_events
  FOR DELETE USING (public.is_company_member(company_id));

-- vehicles
DROP POLICY IF EXISTS vehicles_select_company ON public.vehicles;
CREATE POLICY vehicles_select_company ON public.vehicles
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS vehicles_insert_company ON public.vehicles;
CREATE POLICY vehicles_insert_company ON public.vehicles
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS vehicles_update_company ON public.vehicles;
CREATE POLICY vehicles_update_company ON public.vehicles
  FOR UPDATE USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS vehicles_delete_company ON public.vehicles;
CREATE POLICY vehicles_delete_company ON public.vehicles
  FOR DELETE USING (public.is_company_member(company_id));

-- company_settings
DROP POLICY IF EXISTS company_settings_select_member ON public.company_settings;
CREATE POLICY company_settings_select_member ON public.company_settings
  FOR SELECT USING (public.is_company_member(company_id));

-- driver_documents (no direct company_id; join via drivers)
DROP POLICY IF EXISTS driver_docs_select_member ON public.driver_documents;
CREATE POLICY driver_docs_select_member ON public.driver_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_id
        AND public.is_company_member(d.company_id)
    )
  );

-- reviews
DROP POLICY IF EXISTS reviews_select_member ON public.reviews;
CREATE POLICY reviews_select_member ON public.reviews
  FOR SELECT USING (public.is_company_member(company_id));

-- messages
DROP POLICY IF EXISTS messages_insert_sender ON public.messages;
CREATE POLICY messages_insert_sender ON public.messages
  FOR INSERT WITH CHECK (
    sender_user_id = auth.uid()
    AND (company_id IS NULL OR public.is_company_member(company_id))
  );

-- proof_of_delivery
DROP POLICY IF EXISTS pod_select_company ON public.proof_of_delivery;
CREATE POLICY pod_select_company ON public.proof_of_delivery
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS pod_insert_creator ON public.proof_of_delivery;
CREATE POLICY pod_insert_creator ON public.proof_of_delivery
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

-- vehicle_documents (no direct company_id; join via vehicles)
DROP POLICY IF EXISTS vd_select_company ON public.vehicle_documents;
CREATE POLICY vd_select_company ON public.vehicle_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id
        AND public.is_company_member(v.company_id)
    )
  );

-- vehicle_tracking_history
DROP POLICY IF EXISTS vth_select_company ON public.vehicle_tracking_history;
CREATE POLICY vth_select_company ON public.vehicle_tracking_history
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS vth_insert_company ON public.vehicle_tracking_history;
CREATE POLICY vth_insert_company ON public.vehicle_tracking_history
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

-- invoice_status_history
DROP POLICY IF EXISTS invoice_status_history_member_access ON public.invoice_status_history;
CREATE POLICY invoice_status_history_member_access ON public.invoice_status_history
  FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- invoice_payment_history
DROP POLICY IF EXISTS invoice_payment_history_member_access ON public.invoice_payment_history;
CREATE POLICY invoice_payment_history_member_access ON public.invoice_payment_history
  FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- invoice_disputes
DROP POLICY IF EXISTS invoice_disputes_member_access ON public.invoice_disputes;
CREATE POLICY invoice_disputes_member_access ON public.invoice_disputes
  FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- jobs — use the latest definition (migration 067) which does not reference is_company_member
DROP POLICY IF EXISTS jobs_exchange_select_policy ON public.jobs;
CREATE POLICY jobs_exchange_select_policy ON public.jobs
  FOR SELECT
  USING (
    exchange_visibility = 'exchange'
    AND status = 'posted'
    AND (
      EXISTS (
        SELECT 1 FROM public.company_memberships cm
        WHERE cm.user_id = auth.uid()
          AND cm.status <> 'suspended'
          AND cm.role_in_company IN ('owner', 'admin', 'dispatcher', 'member', 'viewer')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.role IN ('owner', 'broker')
      )
    )
  );

NOTIFY pgrst, 'reload schema';
