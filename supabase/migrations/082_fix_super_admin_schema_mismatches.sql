-- ============================================================
-- Migration 082 — Fix Super Admin Schema Mismatches
-- ============================================================
-- Fixes two production issues identified in the Super Admin pages:
--
-- 1. company_status enum: add 'pending_approval' if the column is typed as
--    an enum that does not include it, so API filters like
--    .eq('status', 'pending_approval') no longer raise:
--    "invalid input value for enum company_status: "pending_approval""
--
-- 2. owner_audit_log: add old_status / new_status columns if they were
--    omitted when the table was first created (e.g. because a CREATE TABLE
--    IF NOT EXISTS ran against a pre-existing table without those columns).
-- ============================================================

BEGIN;

-- ── 1. Extend company_status enum (safe; ADD VALUE is transactional in PG12+)
--      Only executes when the type actually exists as an enum.
DO $$
BEGIN
  -- Add 'pending_approval' if company_status is an enum and lacks the value
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'company_status' AND typtype = 'e'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'company_status'
        AND e.enumlabel = 'pending_approval'
    ) THEN
      ALTER TYPE public.company_status ADD VALUE 'pending_approval';
    END IF;

    -- Also ensure other governance values are present
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'company_status' AND e.enumlabel = 'inactive'
    ) THEN
      ALTER TYPE public.company_status ADD VALUE 'inactive';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'company_status' AND e.enumlabel = 'rejected'
    ) THEN
      ALTER TYPE public.company_status ADD VALUE 'rejected';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'company_status' AND e.enumlabel = 'suspended'
    ) THEN
      ALTER TYPE public.company_status ADD VALUE 'suspended';
    END IF;
  END IF;
END $$;

-- ── 2. Ensure owner_audit_log has old_status / new_status columns
--      Uses ADD COLUMN IF NOT EXISTS so it's a no-op when already present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'owner_audit_log'
  ) THEN
    -- old_status
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'owner_audit_log'
        AND column_name = 'old_status'
    ) THEN
      ALTER TABLE public.owner_audit_log
        ADD COLUMN old_status text NOT NULL DEFAULT '';
    END IF;

    -- new_status
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'owner_audit_log'
        AND column_name = 'new_status'
    ) THEN
      ALTER TABLE public.owner_audit_log
        ADD COLUMN new_status text NOT NULL DEFAULT '';
    END IF;

    -- reason (may also be missing in older table versions)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'owner_audit_log'
        AND column_name = 'reason'
    ) THEN
      ALTER TABLE public.owner_audit_log
        ADD COLUMN reason text NOT NULL DEFAULT '';
    END IF;
  END IF;
END $$;

COMMIT;
