-- ============================================================
-- Migration: broker_carrier_invitations
-- Purpose: Broker-to-carrier network invitations with status
--          tracking, revoke support, audit trail and RLS.
-- ============================================================

-- ── Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broker_carrier_invitations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Broker company that issued the invitation
  broker_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Invited carrier identified by email.
  -- A company_id is populated once the invitation is accepted.
  invited_email     TEXT NOT NULL,
  carrier_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Who issued the invitation (must be an active member of broker_company_id)
  invited_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Workflow states: pending | accepted | revoked | expired
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),

  -- Optional personalised message
  message           TEXT,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at       TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,

  -- Business rule: one active invitation per (broker, email) pair.
  -- Revoked or expired invitations do not block a fresh invitation.
  CONSTRAINT unique_active_broker_carrier_invitation
    UNIQUE NULLS NOT DISTINCT (broker_company_id, invited_email, status)
);

COMMENT ON TABLE broker_carrier_invitations IS
  'Records broker-issued invitations to carrier companies to join the broker''s carrier network. '
  'An invitation may be pending, accepted, revoked or expired. RLS enforces that only members '
  'of the issuing broker company can see or modify their own invitations.';

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bci_broker_company
  ON broker_carrier_invitations (broker_company_id, status);

CREATE INDEX IF NOT EXISTS idx_bci_invited_email
  ON broker_carrier_invitations (invited_email);

CREATE INDEX IF NOT EXISTS idx_bci_carrier_company
  ON broker_carrier_invitations (carrier_company_id);

-- ── updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_broker_carrier_invitation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bci_updated_at ON broker_carrier_invitations;
CREATE TRIGGER trg_bci_updated_at
  BEFORE UPDATE ON broker_carrier_invitations
  FOR EACH ROW EXECUTE FUNCTION set_broker_carrier_invitation_updated_at();

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE broker_carrier_invitations ENABLE ROW LEVEL SECURITY;

-- Broker members can read their own company's invitations
CREATE POLICY bci_select_broker_member ON broker_carrier_invitations
  FOR SELECT
  USING (
    broker_company_id IN (
      SELECT company_id FROM company_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Broker members can insert invitations for their own company
CREATE POLICY bci_insert_broker_member ON broker_carrier_invitations
  FOR INSERT
  WITH CHECK (
    broker_company_id IN (
      SELECT company_id FROM company_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND invited_by = auth.uid()
    -- Prevent duplicate active/pending invitations for the same email
    AND NOT EXISTS (
      SELECT 1 FROM broker_carrier_invitations existing
      WHERE existing.broker_company_id = broker_carrier_invitations.broker_company_id
        AND existing.invited_email = lower(trim(broker_carrier_invitations.invited_email))
        AND existing.status = 'pending'
    )
  );

-- Only the issuing broker member can revoke (update) an invitation
CREATE POLICY bci_update_broker_member ON broker_carrier_invitations
  FOR UPDATE
  USING (
    broker_company_id IN (
      SELECT company_id FROM company_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    broker_company_id IN (
      SELECT company_id FROM company_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Super-admin (service role) can read all — handled by supabaseAdmin bypass.
-- No public delete is permitted; status is set to 'revoked' instead.

-- ── Grants ──────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON broker_carrier_invitations TO authenticated;

-- ── Post-run verification ────────────────────────────────────
-- Run the following to confirm success:
--
-- SELECT table_name, row_security
-- FROM information_schema.tables
-- WHERE table_name = 'broker_carrier_invitations';
--
-- Expected: row_security = YES
