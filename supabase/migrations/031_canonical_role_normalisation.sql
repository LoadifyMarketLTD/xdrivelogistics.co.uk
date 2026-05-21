-- ============================================================
-- 031_canonical_role_normalisation.sql
--
-- Canonical Courier-Exchange-style role model for public.profiles.role
--
-- LIVE DATABASE STATE (runtime-confirmed)
-- ──────────────────────────────────────────────────────────────
-- • public.user_role enum: EXISTS in the live DB despite being absent
--   from all migration files.  The column profiles.role uses this enum,
--   causing LOWER(role) to fail: "function lower(user_role) does not exist".
-- • This migration detects the enum condition and converts profiles.role
--   to plain TEXT first (USING role::text preserves all string values),
--   then performs backfill and constraint work with standard text operations.
-- • public.company_role enum: ('owner','admin','dispatcher','viewer')
--   used only for company_memberships.role_in_company — NOT changed here.
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
--     management dashboard access within a company context.  NOT a passive
--     customer who only submits delivery requests.
--
--   company_admin → admin
--     A company administrator requires full admin dashboard access to manage
--     drivers, jobs, invoices, company settings, and memberships.
--
--   dispatcher    → company  (already handled in app code; normalised here)
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

-- ── 0. Convert profiles.role to TEXT if it is currently an enum type ──────────
--    USING role::text preserves the string label of every existing enum value.
--    This is a no-op on databases where the column is already TEXT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'profiles'
      AND  column_name  = 'role'
      AND  data_type    = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN role TYPE text
      USING role::text;
  END IF;
END $$;

-- ── 1. Backfill: owner aliases ────────────────────────────────────────────────
UPDATE public.profiles
SET    role       = 'owner',
       updated_at = NOW()
WHERE  LOWER(role) IN ('superadmin', 'super_admin', 'platform_owner')
  AND  role <> 'owner';

-- ── 2. Backfill: admin aliases (incl. company_admin) ─────────────────────────
UPDATE public.profiles
SET    role       = 'admin',
       updated_at = NOW()
WHERE  LOWER(role) IN ('company_admin', 'org_admin', 'platform_admin')
  AND  role <> 'admin';

-- ── 3. Backfill: company aliases (incl. broker) ───────────────────────────────
UPDATE public.profiles
SET    role       = 'company',
       updated_at = NOW()
WHERE  LOWER(role) IN ('broker', 'freight_broker', 'carrier', 'dispatcher', 'company_staff')
  AND  role <> 'company';

-- ── 4. Backfill: driver aliases ───────────────────────────────────────────────
UPDATE public.profiles
SET    role       = 'driver',
       updated_at = NOW()
WHERE  LOWER(role) IN ('owner_driver')
  AND  role <> 'driver';

-- ── 5. Backfill: customer aliases ─────────────────────────────────────────────
UPDATE public.profiles
SET    role       = 'customer',
       updated_at = NOW()
WHERE  LOWER(role) IN ('shipper', 'client', 'viewer')
  AND  role <> 'customer';

-- ── 6. Catch-all: any remaining non-canonical value → customer ────────────────
--    Safest fallback: user lands on /customer dashboard.
--    A company admin can correct the profile role via the admin UI if needed.
UPDATE public.profiles
SET    role       = 'customer',
       updated_at = NOW()
WHERE  role NOT IN ('owner', 'admin', 'company', 'driver', 'customer')
  AND  role IS NOT NULL;

-- ── 7. Add CHECK constraint documenting the canonical role set ────────────────
--    Now safe because the column is TEXT and all rows contain canonical values.
--    DO block keeps this idempotent on repeated runs.
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
      CHECK (role IS NULL OR role IN ('owner', 'admin', 'company', 'driver', 'customer'));
  END IF;
END $$;

-- ── 8. Update trigger to normalise role at ingestion time ─────────────────────
--    Replaces the trigger installed by migration 026 with one that converts
--    any legacy or alias role value to a canonical TEXT value before inserting.
--    Because profiles.role is now TEXT, the text assignment is type-safe.
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
  -- Aliases are listed here so any future auth.admin.createUser call
  -- using a legacy role value is silently normalised at DB level.
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
    ELSE                       'customer'   -- safe fallback
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
