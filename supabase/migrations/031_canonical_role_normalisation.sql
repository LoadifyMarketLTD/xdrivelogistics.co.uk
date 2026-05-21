-- ============================================================
-- 031_canonical_role_normalisation.sql
--
-- Canonical Courier-Exchange-style role model for public.profiles.role
--
-- LIVE DATABASE PROBLEM
-- ──────────────────────────────────────────────────────────────
-- The live database has profiles.role typed as a user_role ENUM.
-- This causes two distinct plan-time failures for any top-level SQL:
--
--   (a) LOWER(role)          → "function lower(user_role) does not exist"
--   (b) SET role = 'company' → "invalid input value for enum user_role: company"
--       (if 'company' is not a label in the enum)
--
-- Root cause: PostgreSQL parses and type-checks every top-level statement
-- BEFORE executing it.  A DO block that runs first cannot change the
-- column type in a way that affects the plan of a subsequent top-level
-- statement in the same script — the subsequent statement was already
-- rejected at parse time.
--
-- FIX: All statements that read or write profiles.role are placed inside
-- a single DO $$ block and run via EXECUTE (dynamic SQL).  PostgreSQL
-- does NOT type-check EXECUTE strings at block-definition time; it plans
-- and executes them only when the EXECUTE line is reached at runtime.
-- The ALTER TABLE therefore runs first, after which all UPDATEs see the
-- column as TEXT and succeed.
--
-- This migration is also re-entrant: if the column is already TEXT it
-- skips the ALTER TABLE and proceeds directly to the backfill UPDATEs.
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
--     On a Courier Exchange platform a freight broker is a company-level
--     operator who posts loads, manages carrier assignments, and handles
--     invoicing.  This is identical to the company/dispatcher access model:
--     full job management dashboard within a company context.
--     NOT a passive customer who only submits delivery requests.
--
--   company_admin → admin
--     Full admin dashboard: drivers, jobs, invoices, settings, memberships.
--
--   dispatcher / company_staff / freight_broker / carrier → company
--   org_admin / platform_admin                           → admin
--   superadmin / super_admin / platform_owner            → owner
--   owner_driver                                         → driver
--   shipper / client / viewer                            → customer
--
--   Any unrecognised value → customer (safest fallback).
-- ============================================================

DO $$
DECLARE
  v_col_type text;
BEGIN

  -- ── 0. Detect whether profiles.role is an enum (or any non-text type) ────────
  SELECT t.typname INTO v_col_type
  FROM   pg_attribute  a
  JOIN   pg_class      c ON c.oid = a.attrelid
  JOIN   pg_namespace  n ON n.oid = c.relnamespace
  JOIN   pg_type       t ON t.oid = a.atttypid
  WHERE  n.nspname    = 'public'
    AND  c.relname    = 'profiles'
    AND  a.attname    = 'role'
    AND  NOT a.attisdropped;

  IF v_col_type IS NOT NULL AND v_col_type <> 'text' THEN
    -- Convert enum → text.  USING role::text preserves every existing label.
    -- Both statements use EXECUTE so they are not plan-checked against the
    -- current enum type.
    EXECUTE 'ALTER TABLE public.profiles
               ALTER COLUMN role TYPE text
               USING role::text';

    EXECUTE 'ALTER TABLE public.profiles
               ALTER COLUMN role SET DEFAULT ''customer''';

    RAISE NOTICE 'profiles.role converted from % to text', v_col_type;
  ELSE
    RAISE NOTICE 'profiles.role is already text; skipping ALTER TABLE';
  END IF;

  -- ── 1. Backfill: owner aliases ─────────────────────────────────────────────
  -- All UPDATE strings use EXECUTE so PostgreSQL plans them AFTER the ALTER
  -- TABLE above has already run, guaranteeing the column is TEXT.
  EXECUTE '
    UPDATE public.profiles
    SET    role       = ''owner'',
           updated_at = NOW()
    WHERE  LOWER(role) IN (''superadmin'', ''super_admin'', ''platform_owner'')
      AND  role <> ''owner''
  ';

  -- ── 2. Backfill: admin aliases (incl. company_admin) ─────────────────────
  EXECUTE '
    UPDATE public.profiles
    SET    role       = ''admin'',
           updated_at = NOW()
    WHERE  LOWER(role) IN (''company_admin'', ''org_admin'', ''platform_admin'')
      AND  role <> ''admin''
  ';

  -- ── 3. Backfill: company aliases (incl. broker) ───────────────────────────
  EXECUTE '
    UPDATE public.profiles
    SET    role       = ''company'',
           updated_at = NOW()
    WHERE  LOWER(role) IN (''broker'', ''freight_broker'', ''carrier'',
                            ''dispatcher'', ''company_staff'')
      AND  role <> ''company''
  ';

  -- ── 4. Backfill: driver aliases ───────────────────────────────────────────
  EXECUTE '
    UPDATE public.profiles
    SET    role       = ''driver'',
           updated_at = NOW()
    WHERE  LOWER(role) IN (''owner_driver'')
      AND  role <> ''driver''
  ';

  -- ── 5. Backfill: customer aliases ─────────────────────────────────────────
  EXECUTE '
    UPDATE public.profiles
    SET    role       = ''customer'',
           updated_at = NOW()
    WHERE  LOWER(role) IN (''shipper'', ''client'', ''viewer'')
      AND  role <> ''customer''
  ';

  -- ── 6. Catch-all: any remaining non-canonical value → customer ─────────────
  EXECUTE '
    UPDATE public.profiles
    SET    role       = ''customer'',
           updated_at = NOW()
    WHERE  role NOT IN (''owner'', ''admin'', ''company'', ''driver'', ''customer'')
      AND  role IS NOT NULL
  ';

  RAISE NOTICE 'profiles.role backfill complete';

END $$;

-- ── 7. Add CHECK constraint documenting the canonical role set ────────────────
-- This is a top-level DDL statement.  By the time PostgreSQL executes this,
-- the column is TEXT (converted by the DO block above), so there is no
-- enum-related plan-time issue here.
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
-- Replaces the trigger installed by migration 026.  The function body is pure
-- PL/pgSQL and assigns into a text variable, so there is no enum issue here.
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

  -- Map any incoming raw or legacy role value to a canonical app role.
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

  INSERT INTO public.profiles
         (user_id, role, status, full_name, phone, is_driver, created_at, updated_at)
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
