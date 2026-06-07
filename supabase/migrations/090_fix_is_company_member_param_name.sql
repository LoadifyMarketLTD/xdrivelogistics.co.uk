-- ============================================================
-- Migration 090 — Fix is_company_member parameter name clash
-- ============================================================
-- Root cause: migration 042 (adaptive repair) detected no named
-- parameter and recreated the function with param "_company_id".
-- Subsequent migrations use CREATE OR REPLACE with param "cid",
-- which PostgreSQL rejects (cannot rename an input parameter via
-- CREATE OR REPLACE). Fix: DROP then RECREATE with "cid".
-- ============================================================

DROP FUNCTION IF EXISTS public.is_company_member(uuid);

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
