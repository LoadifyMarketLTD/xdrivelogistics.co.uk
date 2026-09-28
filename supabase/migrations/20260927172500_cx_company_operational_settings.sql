BEGIN;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS operator_licence_number text,
  ADD COLUMN IF NOT EXISTS finance_email text,
  ADD COLUMN IF NOT EXISTS secondary_phone text,
  ADD COLUMN IF NOT EXISTS email_visible_to_members boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_location text,
  ADD COLUMN IF NOT EXISTS directory_location text,
  ADD COLUMN IF NOT EXISTS booking_footer text,
  ADD COLUMN IF NOT EXISTS delivery_note_company_name text,
  ADD COLUMN IF NOT EXISTS delivery_note_customer_phone text,
  ADD COLUMN IF NOT EXISTS delivery_note_driver_phone text,
  ADD COLUMN IF NOT EXISTS delivery_note_footer text,
  ADD COLUMN IF NOT EXISTS waiting_time_terms text,
  ADD COLUMN IF NOT EXISTS loading_time_terms text,
  ADD COLUMN IF NOT EXISTS cancellation_terms text,
  ADD COLUMN IF NOT EXISTS other_charges text,
  ADD COLUMN IF NOT EXISTS feedback_view_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS driver_must_confirm_acceptance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_load_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_notification_bar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_average_speed_replay boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accept_electronic_quotes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accept_quotes_approved_members_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_international_quotes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receive_quote_email_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_full_postcode_posted_loads boolean NOT NULL DEFAULT true;

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_feedback_view_days_check;
ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_feedback_view_days_check
  CHECK (feedback_view_days IN (30, 60, 90, 180, 365));

CREATE TABLE IF NOT EXISTS public.company_specialist_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  capability_code text NOT NULL,
  verification_required boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'declared',
  evidence_document_id uuid NULL,
  declared_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note text NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_specialist_capabilities_status_check
    CHECK (verification_status IN ('declared','pending','verified','rejected')),
  CONSTRAINT company_specialist_capabilities_code_check
    CHECK (capability_code IN (
      '24_hour',
      'adr',
      'dgsa_qualified',
      'fors_bronze',
      'fors_silver',
      'fors_gold',
      'frozen',
      'hanging_garment',
      'high_security',
      'installation_swapout',
      'aviation_level_ab',
      'cargo_operated_level_d',
      'refrigerated_chilled',
      'removals',
      'waste_carrier',
      'weee',
      'authorised_economic_operator',
      'cmr'
    )),
  UNIQUE(company_id, capability_code)
);

ALTER TABLE public.company_specialist_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_specialist_capabilities_select_member ON public.company_specialist_capabilities;
CREATE POLICY company_specialist_capabilities_select_member
  ON public.company_specialist_capabilities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.company_id = company_specialist_capabilities.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS company_specialist_capabilities_insert_admin ON public.company_specialist_capabilities;
CREATE POLICY company_specialist_capabilities_insert_admin
  ON public.company_specialist_capabilities
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS company_specialist_capabilities_update_admin ON public.company_specialist_capabilities;
CREATE POLICY company_specialist_capabilities_update_admin
  ON public.company_specialist_capabilities
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS company_specialist_capabilities_delete_admin ON public.company_specialist_capabilities;
CREATE POLICY company_specialist_capabilities_delete_admin
  ON public.company_specialist_capabilities
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

CREATE TABLE IF NOT EXISTS public.company_member_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  blocked_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reason text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_member_blocks_no_self CHECK (blocker_company_id <> blocked_company_id),
  UNIQUE(blocker_company_id, blocked_company_id)
);

ALTER TABLE public.company_member_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_member_blocks_select_admin ON public.company_member_blocks;
CREATE POLICY company_member_blocks_select_admin
  ON public.company_member_blocks
  FOR SELECT TO authenticated
  USING (public.is_company_admin(blocker_company_id));

DROP POLICY IF EXISTS company_member_blocks_insert_admin ON public.company_member_blocks;
CREATE POLICY company_member_blocks_insert_admin
  ON public.company_member_blocks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(blocker_company_id));

DROP POLICY IF EXISTS company_member_blocks_delete_admin ON public.company_member_blocks;
CREATE POLICY company_member_blocks_delete_admin
  ON public.company_member_blocks
  FOR DELETE TO authenticated
  USING (public.is_company_admin(blocker_company_id));

CREATE INDEX IF NOT EXISTS idx_company_member_blocks_blocker
  ON public.company_member_blocks(blocker_company_id, blocked_company_id);
CREATE INDEX IF NOT EXISTS idx_company_member_blocks_blocked
  ON public.company_member_blocks(blocked_company_id, blocker_company_id);

COMMENT ON COLUMN public.company_settings.operator_licence_number IS
  'Company operator licence reference where applicable. Presence does not itself prove validity.';
COMMENT ON COLUMN public.company_settings.default_payment_terms IS
  'Canonical XDrive default payment terms; allowed values are governed by the finance contract.';
COMMENT ON TABLE public.company_specialist_capabilities IS
  'Company-declared specialist services/accreditations. Regulated capabilities can remain pending until evidence is verified.';
COMMENT ON TABLE public.company_member_blocks IS
  'Company-to-company interaction blocks controlled by company owners/admins.';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_specialist_capabilities TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.company_member_blocks TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
