-- ============================================================
-- Migration 076 — Fix owner_audit_log missing actor_user_id column
-- ============================================================
--
-- Root cause:
--   Migration 075 defined owner_audit_log with actor_user_id, but because
--   the table already existed in production (created by an earlier draft or
--   manual statement), the CREATE TABLE IF NOT EXISTS in 075 was a no-op and
--   the actor_user_id column was never added.
--
-- Fix:
--   Add the column if absent.  All existing rows will receive NULL; new rows
--   written by the governance API always supply the value explicitly.
-- ============================================================

ALTER TABLE public.owner_audit_log
  ADD COLUMN IF NOT EXISTS actor_user_id uuid;
