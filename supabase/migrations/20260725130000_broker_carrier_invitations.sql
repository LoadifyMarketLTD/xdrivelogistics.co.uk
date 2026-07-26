-- Migration: broker_carrier_invitations
-- Brokers can invite carrier companies (by email or existing company) into
-- their preferred network and revoke access as required by BW-03.

CREATE TABLE IF NOT EXISTS public.broker_carrier_invitations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  carrier_email      text,
  carrier_company_id uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  status             text        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'revoked')),
  message            text,
  invited_by         uuid        REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- At least one of carrier_email or carrier_company_id must be provided.
-- Conditional: only applies when the carrier_email column exists.
-- (A later migration may rename carrier_email → invited_email with a NOT NULL
--  constraint that makes this check redundant.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'broker_carrier_invitations'
      AND column_name  = 'carrier_email'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'broker_carrier_inv_target_check'
      AND conrelid = 'public.broker_carrier_invitations'::regclass
  ) THEN
    ALTER TABLE public.broker_carrier_invitations
      ADD CONSTRAINT broker_carrier_inv_target_check
      CHECK (carrier_email IS NOT NULL OR carrier_company_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS broker_carrier_inv_broker_idx
  ON public.broker_carrier_invitations (broker_company_id, created_at DESC);

-- Index on carrier_email only exists when that column is present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'broker_carrier_invitations'
      AND column_name  = 'carrier_email'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'broker_carrier_invitations'
      AND indexname  = 'broker_carrier_inv_email_idx'
  ) THEN
    EXECUTE 'CREATE INDEX broker_carrier_inv_email_idx
               ON public.broker_carrier_invitations (carrier_email)
               WHERE carrier_email IS NOT NULL';
  END IF;
END $$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_broker_carrier_inv_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broker_carrier_inv_updated_at ON public.broker_carrier_invitations;
CREATE TRIGGER trg_broker_carrier_inv_updated_at
  BEFORE UPDATE ON public.broker_carrier_invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_broker_carrier_inv_updated_at();

ALTER TABLE public.broker_carrier_invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'broker_carrier_invitations'
    AND policyname = 'broker_carrier_inv_select'
  ) THEN
    CREATE POLICY "broker_carrier_inv_select"
    ON public.broker_carrier_invitations FOR SELECT
    TO authenticated
    USING (broker_company_id = public.auth_company_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'broker_carrier_invitations'
    AND policyname = 'broker_carrier_inv_insert'
  ) THEN
    CREATE POLICY "broker_carrier_inv_insert"
    ON public.broker_carrier_invitations FOR INSERT
    TO authenticated
    WITH CHECK (broker_company_id = public.auth_company_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'broker_carrier_invitations'
    AND policyname = 'broker_carrier_inv_update'
  ) THEN
    CREATE POLICY "broker_carrier_inv_update"
    ON public.broker_carrier_invitations FOR UPDATE
    TO authenticated
    USING (broker_company_id = public.auth_company_id());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
