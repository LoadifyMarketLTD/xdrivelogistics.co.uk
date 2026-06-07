-- ============================================================
-- Migration 089 — Stripe Billing Integration (Future Phase)
-- ============================================================
-- Stripe integration is explicitly out of MVP scope.
-- This migration is intentionally a no-op for MVP environments.
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Skipping migration 089: Stripe billing is future phase only, not part of MVP.';
END $$;
