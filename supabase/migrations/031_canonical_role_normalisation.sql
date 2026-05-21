-- ============================================================
-- 031_canonical_role_normalisation.sql
--
-- Canonical Courier-Exchange-style role model for public.profiles.role
--
-- LIVE DATABASE STATE (runtime-confirmed)
-- ──────────────────────────────────────────────────────────────
-- • public.user_role enum: EXISTS in the live DB despite being absent
--   from all migration files.  The column profiles.role is typed as this
--   enum, which causes LOWER(role) to fail at plan time:
--     "function lower(user_role) does not exist"
--
-- HOW THIS MIGRATION HANDLES IT
-- ──────────────────────────────────────────────────────────────
-- Step 0  — Detects the enum via pg_catalog (more reliable than
--            information_schema) and converts the column to plain TEXT
--            using EXECUTE (dynamic SQL) so PostgreSQL cannot plan-time
--            reject it.  Uses USING role::text to preserve every existing
--            label.  No-op if the column is already TEXT.
--
-- Steps 1-6 — Every WHERE clause uses role::text so the statement is
--              valid at plan time regardless of whether the column is
--              still an enum or has been converted to TEXT by Step 0.
--              This makes the migration re-entrant and safe to re-run.
--
-- Step 7  — CHECK constraint (idempotent DO block).
-- Step 8  — Replaces the auth.users INSERT trigger to normalise any
--            future legacy role values at ingestion time.
--
-- CANONICAL APP ROLES  (profiles.role, TEXT after this migration)
-- ──────────────────────────────────────────────────────────────────
--   owner    – Platform owner; full platform control across all companies.
--   admin    – Company administrator; manages company, jobs, drivers, invoices.
--   company  – Company staff / dispatcher; manages jobs under one company.
--   driver   – Delivery driver; views assigned jobs, updates status, uploads POD.
--   customer – Shipper / customer; requests quotes, posts delivery requests.
--
-- LEGACY ROLE MAPPING DECISIONS
-- ──────────────────────────────
--   broker       → company
--     On a Courier Exchange platform a freight broker is a company-level operator
--     who posts loads, manages carrier assignments, and handles invoicing.
--     This is identical to the company/dispatcher access model: full job
--     management dashboard within a company context.  NOT a passive customer.
--
--   company_admin → admin
--     A company administrator needs full admin dashboard access: drivers,
--     jobs, invoices, company settings, memberships.
--
--   dispatcher    → company  (also handled in app code; normalised here)
--   company_staff → company
--   freight_broker→ company
--   carrier       → company
--   org_admin     → admin
--   platform_admin→ admin
--   superadmin    → owner
--   super_admin   → owner
--   platform_owner→ owner
--   owner_driver  → driver
--   shipper       → customer
--   client        → customer
--   viewer        → customer (old registration default)
--
--   Any other unrecognised value → customer (safest fallback; admins can
--   correct individual profiles via the admin UI if needed).
-- ============================================================

-- ── 0. Convert profiles.role to TEXT if it is currently any non-text type ─────
--
--    Uses pg_catalog (not information_schema) for reliable type detection.
--    Uses EXECUTE (dynamic SQL) so PostgreSQL cannot reject the ALTER TABLE
--    at plan time when the column is still an enum type.
--    No-op on databases where the column is already TEXT.
DO $$
DECLARE
  v_typname text;
BEGIN
  SELECT t.typname INTO v_typname
  FROM   pg_attribute  a
  JOIN   pg_class      c ON c.oid = a.attrelid
  JOIN   pg_namespace  n ON n.oid = c.relnamespace
  JOIN   pg_type       t ON t.oid = a.atttypid
  WHERE  n.nspname = 'public'
    AND  c.relname  = 'profiles'
    AND  a.attname  = 'role'
    AND  NOT a.attisdropped;

  IF v_typname IS NOT NULL AND v_typname <> 'text' THEN
    -- USING role::text converts every enum label to its text representation.
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN role TYPE text USING role::text';
    -- Update the column default to the canonical equivalent of the old 'viewer'.
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT ''customer''';
  END IF;
END $$;

-- ── 1. Backfill: owner aliases ─────────────────────────────────────────────────
-- role::text in WHERE makes this statement plan-safe whether role is enum or
-- text at the time PostgreSQL parses this UPDATE.
UPDATE public.profiles
SET    role       = 'owner',
       updated_at = NOW()
WHERE  LOWER(role::text) IN ('superadmin', 'super_admin', 'platform_owner')
  AND  role::text <> 'owner';

-- ── 2. Backfill: admin aliases (incl. company_admin) ──────────────────────────
UPDATE public.profiles
SET    role       = 'admin',
       updated_at = NOW()
WHERE  LOWER(role::text) IN ('company_admin', 'org_admin', 'platform_admin')
  AND  role::text <> 'admin';

-- ── 3. Backfill: company aliases (incl. broker) ────────────────────────────────
UPDATE public.profiles
SET    role       = 'company',
       updated_at = NOW()
WHERE  LOWER(role::text) IN ('broker', 'freight_broker', 'carrier', 'dispatcher', 'company_staff')
  AND  role::text <> 'company';

-- ── 4. Backfill: driver aliases ────────────────────────────────────────────────
UPDATE public.profiles
SET    role       = 'driver',
       updated_at = NOW()
WHERE  LOWER(role::text) IN ('owner_driver')
  AND  role::text <> 'driver';

-- ── 5. Backfill: customer aliases ──────────────────────────────────────────────
UPDATE public.profiles
SET    role       = 'customer',
       updated_at = NOW()
WHERE  LOWER(role::text) IN ('shipper', 'client', 'viewer')
  AND  role::text <> 'customer';

-- ── 6. Catch-all: any remaining non-canonical value → customer ─────────────────
--    role::text NOT IN (...) is safe regardless of column type.
UPDATE public.profiles
SET    role       = 'customer',
       updated_at = NOW()
WHERE  role::text NOT IN ('owner', 'admin', 'company', 'driver', 'customer')
  AND  role IS NOT NULL;

-- ── 7. Add CHECK constraint documenting the canonical role set ─────────────────
--    role::text inside the CHECK expression works for both TEXT and enum columns.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'profiles'
      AND  constraint_name = 'profiles_role_canonical'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_canonical
      CHECK (role IS NULL OR role::text IN ('owner', 'admin', 'company', 'driver', 'customer'));
  END IF;
END $$;

-- ── 8. Update trigger to normalise role at ingestion time ──────────────────────
--    Replaces the trigger installed by migration 026.  Because profiles.role is
--    TEXT after Step 0, inserting the text variable v_role is type-safe.
CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_role  text;
  v_role      text;
  v_full_name text;
  v_phone     text;
  v_is_driver boolean;
BEGIN
  v_raw_role := LOWER(COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    NEW.raw_user_meta_data ->> 'requested_role',
    'customer'
  ));

  -- Map incoming raw role to canonical app role.
  v_role := CASE v_raw_role
    WHEN 'owner'          THEN 'owner'
    WHEN 'superadmin'     THEN 'owner'
    WHEN 'super_admin'    THEN 'owner'
    WHEN 'platform_owner' THEN 'owner'
    WHEN 'admin'          THEN 'admin'
    WHEN 'company_admin'  THEN 'admin'
    WHEN 'org_admin'      THEN 'admin'
    WHEN 'platform_admin' THEN 'admin'
    WHEN 'company'        THEN 'company'
    WHEN 'dispatcher'     THEN 'company'
    WHEN 'company_staff'  THEN 'company'
    WHEN 'broker'         THEN 'company'
    WHEN 'freight_broker' THEN 'company'
    WHEN 'carrier'        THEN 'company'
    WHEN 'driver'         THEN 'driver'
    WHEN 'owner_driver'   THEN 'driver'
    WHEN 'customer'       THEN 'customer'
    WHEN 'shipper'        THEN 'customer'
    WHEN 'client'         THEN 'customer'
    WHEN 'viewer'         THEN 'customer'
    ELSE                       'customer'
  END;

  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name'
  );
  v_phone     := NEW.raw_user_meta_data ->> 'phone';
  v_is_driver := v_role = 'driver';

  INSERT INTO public.profiles (user_id, role, status, full_name, phone, is_driver, created_at, updated_at)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data ->> 'status', 'active'),
    v_full_name,
    v_phone,
    v_is_driver,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE
    SET role       = COALESCE(EXCLUDED.role,      public.profiles.role),
        status     = COALESCE(EXCLUDED.status,    public.profiles.status),
        full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone      = COALESCE(EXCLUDED.phone,     public.profiles.phone),
        is_driver  = EXCLUDED.is_driver,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
