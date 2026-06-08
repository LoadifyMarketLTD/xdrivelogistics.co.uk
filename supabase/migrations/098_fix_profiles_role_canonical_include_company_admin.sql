-- 098_fix_profiles_role_canonical_include_company_admin.sql
--
-- ROOT CAUSE:
--   Migration 056 set profiles_role_canonical to allow only
--   ('owner','admin','company','driver','customer').
--   Migration 063 (expand constraint) was never applied in production.
--   Migration 066 updated the auth trigger to write 'company_admin'
--   (not 'admin') and 'company_staff' (not 'company'), causing:
--     "new row for relation profiles violates check constraint
--      profiles_role_canonical"
--
-- This migration (idempotent):
--   1. Backfills legacy 'admin' rows → 'company_admin'
--      and legacy 'company' rows → 'company_staff'
--   2. Drops + re-adds profiles_role_canonical with the full expanded set:
--      owner | broker | company_admin | company_staff | driver | customer

-- ── 1. Backfill legacy role values ──────────────────────────────────────────

UPDATE public.profiles
SET    role       = 'company_admin',
       updated_at = NOW()
WHERE  role = 'admin';

UPDATE public.profiles
SET    role       = 'company_staff',
       updated_at = NOW()
WHERE  role = 'company';

-- ── 2. Expand the CHECK constraint ──────────────────────────────────────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_canonical;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_canonical
  CHECK (role IS NULL OR role IN (
    'owner', 'broker', 'company_admin', 'company_staff', 'driver', 'customer'
  ));

NOTIFY pgrst, 'reload schema';
