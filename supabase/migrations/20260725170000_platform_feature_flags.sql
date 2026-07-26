-- ============================================================
-- Migration: platform_feature_flags
-- Purpose:   Persistent feature flag storage for Super Admin.
--            Flags can be toggled at runtime without a deployment.
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_feature_flags (
  key           TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'General',
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE platform_feature_flags IS
  'Runtime feature flags toggled by the platform owner via Super Admin. '
  'Read-only via service role; no browser access.';

-- Seed with the known platform flags
INSERT INTO platform_feature_flags (key, label, description, category, is_enabled)
VALUES
  ('exchange_marketplace',        'Exchange Marketplace',               'Allows companies to post jobs to the public exchange for bidding.',                       'Marketplace', true),
  ('bid_acceptance_workflow',     'Bid Acceptance Workflow',            'Companies can accept/reject inbound bids on exchange jobs.',                              'Operations',  true),
  ('pod_capture',                 'Proof of Delivery Capture',          'Drivers can capture POD photos and signature on delivery.',                               'Operations',  true),
  ('invoice_generation',          'Invoice Generation',                 'Automatic invoice creation on job delivery confirmation.',                                'Finance',     true),
  ('dispute_filing',              'Invoice Dispute Filing',             'Companies can raise disputes against issued invoices.',                                   'Finance',     true),
  ('stripe_billing_future_phase', 'Stripe Billing (Future Phase)',      'Stripe checkout/connect automation — explicitly out of MVP scope.',                       'Finance',     false),
  ('notifications',               'Notification System',                'In-app and email notifications for job events.',                                         'Platform',    true),
  ('document_review',             'Document Review Queue',              'Admin can review and approve uploaded compliance documents.',                              'Compliance',  true),
  ('broker_carrier_network',      'Broker Carrier Network',             'Brokers can invite and manage a private carrier network.',                                'Marketplace', true),
  ('driver_mobile_app',           'Driver Mobile App',                  'Native Android/iOS app for driver job management.',                                      'Operations',  true),
  ('company_suspension',          'Company Suspension Controls',        'Super admin can suspend and reinstate companies.',                                        'Governance',  true),
  ('audit_logging',               'Audit Logging',                      'All governance actions are written to the owner audit log.',                              'Platform',    true)
ON CONFLICT (key) DO NOTHING;

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_platform_feature_flag_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pff_updated_at ON platform_feature_flags;
CREATE TRIGGER trg_pff_updated_at
  BEFORE UPDATE ON platform_feature_flags
  FOR EACH ROW EXECUTE FUNCTION set_platform_feature_flag_updated_at();

-- RLS: service role only (no browser access)
ALTER TABLE platform_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY pff_service_role_only ON platform_feature_flags
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_pff_category ON platform_feature_flags (category);

-- Post-run verification:
-- SELECT key, is_enabled FROM platform_feature_flags ORDER BY category, key;
