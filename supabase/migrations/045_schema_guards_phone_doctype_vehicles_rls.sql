-- Migration 045: Schema guards for companies.phone, vehicle_documents.doc_type,
--                and vehicles INSERT RLS for operators
--
-- Purpose:
-- 1) companies.phone was absent from the schema cache in production, blocking
--    /admin/settings save (live error: "Could not find the 'phone' column").
--    Add it idempotently.
-- 2) vehicle_documents.doc_type was missing in production, breaking
--    /admin/documents load and upload.  Add it idempotently.
-- 3) The vehicles table only had a FOR ALL admin-only policy.  Insert by a
--    company operator (non-viewer, non-suspended member) was blocked with an
--    RLS violation.  Add a dedicated INSERT policy using is_company_operator,
--    consistent with the pattern used for jobs.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) companies.phone (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS phone text;

-- ---------------------------------------------------------------------------
-- 2) vehicle_documents.doc_type (idempotent)
--    No NOT NULL constraint here — existing rows may predate the column.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vehicle_documents
  ADD COLUMN IF NOT EXISTS doc_type text;

-- ---------------------------------------------------------------------------
-- 3) vehicles INSERT policy for operators
--    Allows any non-suspended, non-viewer company member to create vehicles.
--    The existing vehicles_all_admin (FOR ALL) continues to cover
--    UPDATE and DELETE for admins/owners.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "vehicles_insert_operator" ON public.vehicles;
CREATE POLICY "vehicles_insert_operator"
  ON public.vehicles
  FOR INSERT
  WITH CHECK (public.is_company_operator(company_id));

COMMIT;
