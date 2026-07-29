-- Identity, compliance and anti-duplicate-account foundation.
--
-- Product invariant:
--   one verified person -> one active platform identity -> one active company relationship.
--
-- This migration is intentionally fail-closed. If existing production data contains
-- duplicate active memberships or duplicate driver identities, it stops before adding
-- uniqueness constraints so the records can be reviewed rather than silently deleted.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- -----------------------------------------------------------------------------
-- 1. Preflight: never hide or auto-delete existing identity conflicts.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT cm.user_id
    FROM public.company_memberships cm
    WHERE cm.user_id IS NOT NULL
      AND cm.status::text = 'active'
    GROUP BY cm.user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Identity compliance preflight failed: at least one user has multiple active company memberships.';
  END IF;

  IF EXISTS (
    SELECT d.user_id
    FROM public.drivers d
    WHERE d.user_id IS NOT NULL
    GROUP BY d.user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Identity compliance preflight failed: at least one auth user is linked to multiple driver identities.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS company_memberships_one_active_company_per_user_uidx
  ON public.company_memberships (user_id)
  WHERE user_id IS NOT NULL AND status::text = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS drivers_one_identity_per_auth_user_uidx
  ON public.drivers (user_id)
  WHERE user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Onboarding risk hold. A suspected duplicate can never be approved while held.
-- -----------------------------------------------------------------------------
ALTER TABLE public.onboarding_applications
  ADD COLUMN IF NOT EXISTS risk_status text NOT NULL DEFAULT 'clear',
  ADD COLUMN IF NOT EXISTS risk_reason text,
  ADD COLUMN IF NOT EXISTS risk_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS risk_reviewed_by uuid REFERENCES auth.users(id);

ALTER TABLE public.onboarding_applications
  DROP CONSTRAINT IF EXISTS onboarding_applications_risk_status_check;

ALTER TABLE public.onboarding_applications
  ADD CONSTRAINT onboarding_applications_risk_status_check
  CHECK (risk_status IN ('clear', 'review_required', 'on_hold', 'confirmed_fraud')) NOT VALID;

ALTER TABLE public.onboarding_applications
  VALIDATE CONSTRAINT onboarding_applications_risk_status_check;

CREATE INDEX IF NOT EXISTS onboarding_applications_risk_queue_idx
  ON public.onboarding_applications (risk_status, updated_at DESC)
  WHERE risk_status <> 'clear';

-- -----------------------------------------------------------------------------
-- 3. Data fields required for exact document matching and later OCR extraction.
--    Raw document numbers are not stored here; only a one-way hash and last four.
-- -----------------------------------------------------------------------------
ALTER TABLE public.company_documents
  ADD COLUMN IF NOT EXISTS file_sha256 text,
  ADD COLUMN IF NOT EXISTS holder_name text,
  ADD COLUMN IF NOT EXISTS document_number_hash text,
  ADD COLUMN IF NOT EXISTS document_number_last4 text,
  ADD COLUMN IF NOT EXISTS issued_date date,
  ADD COLUMN IF NOT EXISTS risk_status text NOT NULL DEFAULT 'clear',
  ADD COLUMN IF NOT EXISTS risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.driver_identity_documents
  ADD COLUMN IF NOT EXISTS file_sha256 text,
  ADD COLUMN IF NOT EXISTS holder_name text,
  ADD COLUMN IF NOT EXISTS document_number_hash text,
  ADD COLUMN IF NOT EXISTS document_number_last4 text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS issued_date date,
  ADD COLUMN IF NOT EXISTS risk_status text NOT NULL DEFAULT 'clear',
  ADD COLUMN IF NOT EXISTS risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.driver_documents
  ADD COLUMN IF NOT EXISTS file_sha256 text,
  ADD COLUMN IF NOT EXISTS holder_name text,
  ADD COLUMN IF NOT EXISTS document_number_hash text,
  ADD COLUMN IF NOT EXISTS document_number_last4 text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS risk_status text NOT NULL DEFAULT 'clear',
  ADD COLUMN IF NOT EXISTS risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vehicle_documents
  ADD COLUMN IF NOT EXISTS file_sha256 text,
  ADD COLUMN IF NOT EXISTS document_number_hash text,
  ADD COLUMN IF NOT EXISTS document_number_last4 text,
  ADD COLUMN IF NOT EXISTS risk_status text NOT NULL DEFAULT 'clear',
  ADD COLUMN IF NOT EXISTS risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS company_documents_file_sha256_idx
  ON public.company_documents (file_sha256)
  WHERE file_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS driver_identity_documents_file_sha256_idx
  ON public.driver_identity_documents (file_sha256)
  WHERE file_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS driver_documents_file_sha256_idx
  ON public.driver_documents (file_sha256)
  WHERE file_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS vehicle_documents_file_sha256_idx
  ON public.vehicle_documents (file_sha256)
  WHERE file_sha256 IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Central verified-identity registry.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_identity_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  identity_mode text NOT NULL CHECK (
    identity_mode IN ('owner_driver', 'company_driver', 'company_owner', 'company_user')
  ),
  legal_name_normalized text,
  date_of_birth date,
  driving_licence_hash text,
  phone_hash text,
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'on_hold', 'banned', 'closed')
  ),
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_identity_registry_driving_licence_uidx
  ON public.platform_identity_registry (driving_licence_hash)
  WHERE driving_licence_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS platform_identity_registry_name_dob_idx
  ON public.platform_identity_registry (legal_name_normalized, date_of_birth)
  WHERE legal_name_normalized IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. Fingerprint register and manual fraud-review queue.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_family text NOT NULL CHECK (
    document_family IN ('company', 'identity', 'driver', 'vehicle')
  ),
  document_id uuid,
  onboarding_application_id uuid REFERENCES public.onboarding_applications(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  file_sha256 text NOT NULL,
  perceptual_hash text,
  document_number_hash text,
  holder_name_normalized text,
  date_of_birth date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_family, document_id)
);

CREATE INDEX IF NOT EXISTS document_fingerprints_exact_file_idx
  ON public.document_fingerprints (file_sha256);
CREATE INDEX IF NOT EXISTS document_fingerprints_document_number_idx
  ON public.document_fingerprints (document_number_hash)
  WHERE document_number_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_fingerprints_identity_match_idx
  ON public.document_fingerprints (holder_name_normalized, date_of_birth)
  WHERE holder_name_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fraud_review_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  onboarding_application_id uuid REFERENCES public.onboarding_applications(id) ON DELETE SET NULL,
  matched_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  matched_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  case_type text NOT NULL CHECK (
    case_type IN (
      'duplicate_file',
      'duplicate_document_number',
      'duplicate_verified_identity',
      'multiple_active_companies',
      'multiple_active_driver_roles',
      'manual_report'
    )
  ),
  severity text NOT NULL CHECK (severity IN ('medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'investigating', 'cleared', 'confirmed', 'dismissed')
  ),
  automatic_hold boolean NOT NULL DEFAULT true,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_reason text,
  assigned_to uuid REFERENCES auth.users(id),
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fraud_review_cases_open_queue_idx
  ON public.fraud_review_cases (status, severity, created_at DESC)
  WHERE status IN ('open', 'investigating');
CREATE INDEX IF NOT EXISTS fraud_review_cases_subject_user_idx
  ON public.fraud_review_cases (subject_user_id, created_at DESC);

ALTER TABLE public.platform_identity_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_review_cases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_identity_registry FROM anon, authenticated;
REVOKE ALL ON public.document_fingerprints FROM anon, authenticated;
REVOKE ALL ON public.fraud_review_cases FROM anon, authenticated;
GRANT ALL ON public.platform_identity_registry TO service_role;
GRANT ALL ON public.document_fingerprints TO service_role;
GRANT ALL ON public.fraud_review_cases TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Configurable mandatory-document rules.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_document_requirements (
  account_type text NOT NULL,
  document_family text NOT NULL CHECK (document_family IN ('company', 'identity')),
  doc_type text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_type, document_family, doc_type)
);

INSERT INTO public.compliance_document_requirements
  (account_type, document_family, doc_type, required, notes)
VALUES
  ('fleet_courier', 'company', 'company_registration', true, 'Legal business identity.'),
  ('fleet_courier', 'company', 'public_liability', true, 'Platform minimum compliance requirement.'),
  ('fleet_courier', 'company', 'goods_in_transit', true, 'Required before carrying marketplace freight.'),
  ('fleet_courier', 'company', 'vehicle_insurance', true, 'Required before fleet activation.'),
  ('broker_shipper', 'company', 'company_registration', true, 'Legal business identity.'),
  ('broker_shipper', 'company', 'public_liability', true, 'Platform minimum compliance requirement.'),
  ('owner_driver', 'identity', 'driving_licence', true, 'Verified driver identity.'),
  ('owner_driver', 'identity', 'proof_of_address', true, 'Verified residential identity.'),
  ('owner_driver', 'identity', 'right_to_work', true, 'Verified right-to-work evidence.'),
  ('owner_driver', 'identity', 'insurance', true, 'Required before marketplace activation.'),
  ('individual_driver', 'identity', 'driving_licence', true, 'Verified driver identity.'),
  ('individual_driver', 'identity', 'proof_of_address', true, 'Verified residential identity.'),
  ('individual_driver', 'identity', 'right_to_work', true, 'Verified right-to-work evidence.')
ON CONFLICT (account_type, document_family, doc_type)
DO UPDATE SET required = EXCLUDED.required,
              active = true,
              notes = EXCLUDED.notes,
              updated_at = now();

ALTER TABLE public.compliance_document_requirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compliance_document_requirements FROM anon, authenticated;
GRANT ALL ON public.compliance_document_requirements TO service_role;

-- -----------------------------------------------------------------------------
-- 7. Approval gate: an application on risk hold or missing a required approved
--    document cannot transition to approved through any API/RPC path.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_missing_onboarding_documents(p_application_id uuid)
RETURNS TABLE (document_family text, doc_type text, reason text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  WITH app AS (
    SELECT id, account_type
    FROM public.onboarding_applications
    WHERE id = p_application_id
  ),
  requirements AS (
    SELECT r.document_family, r.doc_type
    FROM public.compliance_document_requirements r
    JOIN app ON app.account_type = r.account_type
    WHERE r.active = true
      AND r.required = true
  )
  SELECT
    requirement.document_family,
    requirement.doc_type,
    CASE
      WHEN requirement.document_family = 'company'
        THEN 'Missing, unapproved or expired company document.'
      ELSE 'Missing, unverified or expired identity document.'
    END AS reason
  FROM requirements requirement
  WHERE NOT (
    CASE
      WHEN requirement.document_family = 'company' THEN EXISTS (
        SELECT 1
        FROM public.company_documents document
        WHERE document.onboarding_application_id = p_application_id
          AND document.doc_type = requirement.doc_type
          AND document.status = 'approved'
          AND document.file_path IS NOT NULL
          AND (document.expiry_date IS NULL OR document.expiry_date >= current_date)
      )
      WHEN requirement.document_family = 'identity' THEN EXISTS (
        SELECT 1
        FROM public.driver_identity_documents document
        WHERE document.onboarding_application_id = p_application_id
          AND document.doc_type = requirement.doc_type
          AND document.verification_status = 'verified'
          AND document.file_path IS NOT NULL
          AND (document.expiry_date IS NULL OR document.expiry_date >= current_date)
      )
      ELSE false
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_onboarding_compliance_ready(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_risk_status text;
  v_missing text;
BEGIN
  SELECT risk_status
  INTO v_risk_status
  FROM public.onboarding_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_risk_status <> 'clear' THEN
    RAISE EXCEPTION
      'Cannot approve onboarding while identity risk status is %.', v_risk_status
      USING ERRCODE = '23514';
  END IF;

  SELECT string_agg(format('%s:%s', missing.document_family, missing.doc_type), ', ')
  INTO v_missing
  FROM public.get_missing_onboarding_documents(p_application_id) missing;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot approve onboarding. Required verified documents missing: %', v_missing
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_company_compliance_ready(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application_id uuid;
BEGIN
  SELECT application.id
  INTO v_application_id
  FROM public.onboarding_applications application
  JOIN public.companies company
    ON company.id = p_company_id
  WHERE application.company_id = p_company_id
     OR (application.company_id IS NULL AND application.user_id = company.created_by)
  ORDER BY application.created_at DESC
  LIMIT 1;

  IF v_application_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot activate company without a linked onboarding application.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM public.assert_onboarding_compliance_ready(v_application_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_onboarding_approval_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND COALESCE(OLD.status, '') IS DISTINCT FROM 'approved'
  THEN
    PERFORM public.assert_onboarding_compliance_ready(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_onboarding_approval_compliance
  ON public.onboarding_applications;
CREATE TRIGGER trg_enforce_onboarding_approval_compliance
  BEFORE UPDATE OF status ON public.onboarding_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_onboarding_approval_compliance();

REVOKE ALL ON FUNCTION public.get_missing_onboarding_documents(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_onboarding_compliance_ready(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_missing_onboarding_documents(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_onboarding_compliance_ready(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_company_compliance_ready(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
