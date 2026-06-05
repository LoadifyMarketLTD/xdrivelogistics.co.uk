-- ============================================================
-- Migration 075 — Super-Admin Governance Layer
-- ============================================================
-- STATUS: PROPOSED — do NOT apply until owner approves.
--
-- Changes:
--   1. Allow companies.status = 'pending_approval' | 'rejected'
--      (currently only 'active' and 'suspended' are used)
--   2. Add RLS policy so owner-role users can SELECT all companies
--   3. Add owner_audit_log table for governance actions
-- ============================================================

BEGIN;

-- ── 1. Extend companies.status to allow pending_approval and rejected ──────
-- companies.status is a plain TEXT column (no ENUM constraint), so new
-- status values can be used immediately without any DDL change.
-- This comment documents the canonical set used by the super-admin engine:
--   active | pending_approval | rejected | suspended
-- No DDL is required unless you want a CHECK constraint (see below).

-- Optional: add a CHECK constraint to enforce canonical values.
-- Uncomment and run ONLY if you want strict enforcement:
--
-- ALTER TABLE public.companies
--   DROP CONSTRAINT IF EXISTS companies_status_canonical;
-- ALTER TABLE public.companies
--   ADD CONSTRAINT companies_status_canonical
--   CHECK (status IN ('active', 'pending_approval', 'rejected', 'suspended'));

-- ── 2. Owner-level RLS policy for cross-company SELECT ────────────────────
-- Allows users with profiles.role = 'owner' to SELECT all companies.
-- Required for /api/super-admin/companies to return data server-side
-- (supabaseAdmin bypasses RLS, but this is defence-in-depth for
--  any future client-side owner queries).

DROP POLICY IF EXISTS companies_select_owner_all ON public.companies;
CREATE POLICY companies_select_owner_all ON public.companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- Also allow owner to UPDATE any company (needed for approve/reject/reinstate
-- via supabaseAdmin which bypasses RLS, but included for completeness):
DROP POLICY IF EXISTS companies_update_owner ON public.companies;
CREATE POLICY companies_update_owner ON public.companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- ── 3. Governance audit log table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by  uuid        NOT NULL REFERENCES auth.users(id),
  action        text        NOT NULL,   -- e.g. 'approve_company', 'suspend_company'
  target_type   text        NOT NULL,   -- e.g. 'company', 'user'
  target_id     uuid,                   -- UUID of the affected record
  target_name   text,                   -- Human-readable label for the target
  metadata      jsonb,                  -- Optional extra context
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_audit_log ENABLE ROW LEVEL SECURITY;

-- Only owner-role users can read audit logs; only supabaseAdmin inserts.
CREATE POLICY owner_audit_log_owner_select ON public.owner_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND role = 'owner'
    )
  );

GRANT SELECT ON public.owner_audit_log TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
