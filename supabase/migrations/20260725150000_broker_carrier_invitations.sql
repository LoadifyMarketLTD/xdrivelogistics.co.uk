-- ============================================================
-- Migration: broker_carrier_invitations – schema upgrade
-- Purpose: Rename carrier_email → invited_email (if needed),
--          enforce NOT NULL on invited_email and invited_by,
--          add accepted_at / revoked_at audit timestamps,
--          update status check to include 'expired',
--          add unique active-invitation index per (broker, email),
--          refresh RLS policies to use the canonical column name,
--          and create any missing broker-side policies.
--
-- Idempotent: safe to run more than once, and safe whether
--   • carrier_email (original schema) or invited_email (already
--     renamed) is the current column name, and
--   • the table was created fresh by this migration file or was
--     already created by the 20260725130000 migration.
-- ============================================================

-- ── 0. Ensure the table exists (fresh-install guard) ────────
-- If neither 20260725130000 nor a previous run of this file has
-- created the table yet, create it now with the canonical schema.
CREATE TABLE IF NOT EXISTS public.broker_carrier_invitations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_company_id  UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invited_email      TEXT        NOT NULL,
  carrier_company_id UUID        REFERENCES public.companies(id) ON DELETE SET NULL,
  invited_by         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status             TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'revoked', 'rejected', 'expired')),
  message            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at        TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ
);

-- ── 1. Rename carrier_email → invited_email if needed ───────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'broker_carrier_invitations'
      AND column_name  = 'carrier_email'
  ) THEN
    ALTER TABLE public.broker_carrier_invitations
      RENAME COLUMN carrier_email TO invited_email;
  END IF;
END $$;

-- ── 2. Enforce NOT NULL on invited_email ────────────────────
-- Drop the old nullable-email target check (references carrier_email text)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'broker_carrier_inv_target_check'
      AND conrelid = 'public.broker_carrier_invitations'::regclass
  ) THEN
    ALTER TABLE public.broker_carrier_invitations
      DROP CONSTRAINT broker_carrier_inv_target_check;
  END IF;
END $$;

ALTER TABLE public.broker_carrier_invitations
  ALTER COLUMN invited_email SET NOT NULL;

-- ── 3. Enforce NOT NULL on invited_by ───────────────────────
ALTER TABLE public.broker_carrier_invitations
  ALTER COLUMN invited_by SET NOT NULL;

-- ── 4. Add audit timestamp columns if missing ───────────────
ALTER TABLE public.broker_carrier_invitations
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at  TIMESTAMPTZ;

-- ── 5. Update status check to include 'expired' ─────────────
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.broker_carrier_invitations'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.broker_carrier_invitations DROP CONSTRAINT %I',
      c.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.broker_carrier_invitations
  ADD CONSTRAINT broker_carrier_inv_status_check
  CHECK (status IN ('pending', 'accepted', 'revoked', 'rejected', 'expired'));

-- ── 6. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bci_broker_company
  ON public.broker_carrier_invitations (broker_company_id, status);

CREATE INDEX IF NOT EXISTS idx_bci_invited_email
  ON public.broker_carrier_invitations (invited_email);

CREATE INDEX IF NOT EXISTS idx_bci_carrier_company
  ON public.broker_carrier_invitations (carrier_company_id);

-- One active/pending invitation per (broker, email) pair.
DROP INDEX IF EXISTS unique_active_broker_carrier_invitation;
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_broker_carrier_invitation
  ON public.broker_carrier_invitations (broker_company_id, lower(invited_email))
  WHERE status = 'pending';

-- ── 7. updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_broker_carrier_invitation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bci_updated_at ON public.broker_carrier_invitations;
CREATE TRIGGER trg_bci_updated_at
  BEFORE UPDATE ON public.broker_carrier_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_broker_carrier_invitation_updated_at();

-- ── 8. RLS ───────────────────────────────────────────────────
ALTER TABLE public.broker_carrier_invitations ENABLE ROW LEVEL SECURITY;

-- Refresh carrier SELECT policy with the canonical invited_email column.
DROP POLICY IF EXISTS "broker_carrier_inv_carrier_select" ON public.broker_carrier_invitations;
CREATE POLICY "broker_carrier_inv_carrier_select"
  ON public.broker_carrier_invitations FOR SELECT TO authenticated
  USING (
    carrier_company_id = public.auth_company_id()
    OR (
      invited_email IS NOT NULL
      AND auth.email() IS NOT NULL
      AND lower(invited_email) = lower(auth.email())
    )
  );

-- Replace legacy broker-side policies (from 20260725130000) with
-- membership-based versions that use company_memberships directly.
DROP POLICY IF EXISTS "broker_carrier_inv_select" ON public.broker_carrier_invitations;
DROP POLICY IF EXISTS "broker_carrier_inv_insert" ON public.broker_carrier_invitations;
DROP POLICY IF EXISTS "broker_carrier_inv_update" ON public.broker_carrier_invitations;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'broker_carrier_invitations'
    AND policyname = 'bci_select_broker_member'
  ) THEN
    CREATE POLICY bci_select_broker_member
      ON public.broker_carrier_invitations FOR SELECT
      USING (
        broker_company_id IN (
          SELECT company_id FROM public.company_memberships
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'broker_carrier_invitations'
    AND policyname = 'bci_insert_broker_member'
  ) THEN
    CREATE POLICY bci_insert_broker_member
      ON public.broker_carrier_invitations FOR INSERT
      WITH CHECK (
        broker_company_id IN (
          SELECT company_id FROM public.company_memberships
          WHERE user_id = auth.uid() AND status = 'active'
        )
        AND invited_by = auth.uid()
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'broker_carrier_invitations'
    AND policyname = 'bci_update_broker_member'
  ) THEN
    CREATE POLICY bci_update_broker_member
      ON public.broker_carrier_invitations FOR UPDATE
      USING (
        broker_company_id IN (
          SELECT company_id FROM public.company_memberships
          WHERE user_id = auth.uid() AND status = 'active'
        )
      )
      WITH CHECK (
        broker_company_id IN (
          SELECT company_id FROM public.company_memberships
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

-- ── 9. Grants ────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.broker_carrier_invitations TO authenticated;

NOTIFY pgrst, 'reload schema';
