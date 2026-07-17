-- ============================================================
-- Migration 077 — Enforce NOT NULL on owner_audit_log.actor_user_id
-- ============================================================
--
-- Context:
--   Migration 076 added actor_user_id uuid (nullable) to backfill
--   the column that was missing because the table pre-existed migration 075.
--   All rows written by the governance API always supply actor_user_id.
--   This migration enforces the NOT NULL constraint that was originally
--   intended by the schema in migration 075.
--
-- Prerequisites:
--   Run this only after confirming zero NULL rows:
--     SELECT COUNT(*) FROM public.owner_audit_log WHERE actor_user_id IS NULL;
--   must return 0.
-- ============================================================

ALTER TABLE public.owner_audit_log
  ALTER COLUMN actor_user_id SET NOT NULL;
