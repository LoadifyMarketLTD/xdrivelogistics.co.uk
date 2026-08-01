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
      AND cm.status = 'active'
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
  WHERE user_id IS NOT NULL AND status = 'active';

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

DO $$
BEGIN
  IF EXISTS (
    SELECT fingerprint.file_sha256
    FROM public.document_fingerprints fingerprint
    WHERE fingerprint.file_sha256 IS NOT NULL
    GROUP BY fingerprint.file_sha256
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Identity compliance preflight failed: duplicate document fingerprints already exist for the same SHA-256 file hash.';
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.document_fingerprints_exact_file_idx;
CREATE UNIQUE INDEX IF NOT EXISTS document_fingerprints_exact_file_uidx
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

CREATE UNIQUE INDEX IF NOT EXISTS fraud_review_cases_open_duplicate_file_uidx
  ON public.fraud_review_cases (onboarding_application_id, ((evidence->>'file_sha256')))
  WHERE case_type = 'duplicate_file'
    AND status IN ('open', 'investigating')
    AND onboarding_application_id IS NOT NULL
    AND evidence ? 'file_sha256';

CREATE OR REPLACE FUNCTION public.register_duplicate_document_fraud_case(
  p_subject_user_id uuid,
  p_subject_company_id uuid,
  p_onboarding_application_id uuid,
  p_matched_user_id uuid,
  p_matched_company_id uuid,
  p_file_sha256 text,
  p_attempted_doc_type text,
  p_matched_fingerprint_id uuid,
  p_matched_document_family text,
  p_matched_document_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case_id uuid;
BEGIN
  IF p_onboarding_application_id IS NULL OR COALESCE(trim(p_file_sha256), '') = '' THEN
    RAISE EXCEPTION 'Duplicate-file case registration requires onboarding_application_id and file_sha256.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM 1
  FROM public.onboarding_applications application
  WHERE application.id = p_onboarding_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.fraud_review_cases (
    subject_user_id,
    subject_company_id,
    onboarding_application_id,
    matched_user_id,
    matched_company_id,
    case_type,
    severity,
    status,
    automatic_hold,
    evidence
  )
  VALUES (
    p_subject_user_id,
    p_subject_company_id,
    p_onboarding_application_id,
    p_matched_user_id,
    p_matched_company_id,
    'duplicate_file',
    'critical',
    'open',
    true,
    jsonb_strip_nulls(jsonb_build_object(
      'file_sha256', p_file_sha256,
      'attempted_doc_type', p_attempted_doc_type,
      'matched_fingerprint_id', p_matched_fingerprint_id,
      'matched_document_family', p_matched_document_family,
      'matched_document_id', p_matched_document_id
    ))
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_case_id;

  IF v_case_id IS NULL THEN
    SELECT case_row.id
    INTO v_case_id
    FROM public.fraud_review_cases case_row
    WHERE case_row.onboarding_application_id = p_onboarding_application_id
      AND case_row.case_type = 'duplicate_file'
      AND case_row.status IN ('open', 'investigating')
      AND case_row.evidence->>'file_sha256' = p_file_sha256
    ORDER BY case_row.created_at ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_case_id IS NULL THEN
    RAISE EXCEPTION 'Could not create or resolve duplicate-file fraud case.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.onboarding_applications
  SET risk_status = 'on_hold',
      risk_reason = 'Exact document file already exists on another platform identity.',
      risk_updated_at = now()
  WHERE id = p_onboarding_application_id;

  RETURN v_case_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_review_compliance_document(
  p_actor_user_id uuid,
  p_document_family text,
  p_document_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (document_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table text;
  v_status_column text;
  v_reviewer_column text;
  v_reviewed_at_column text;
  v_reason_column text;
  v_target_type text;
  v_target_name text;
  v_old_status text;
  v_next_status text;
  v_reason text;
BEGIN
  IF p_document_family NOT IN ('driver', 'vehicle', 'company', 'identity') THEN
    RAISE EXCEPTION 'Unsupported document family.'
      USING ERRCODE = '23514';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Unsupported document review action.'
      USING ERRCODE = '23514';
  END IF;

  IF p_document_family = 'driver' THEN
    v_table := 'driver_documents';
    v_status_column := 'status';
    v_reviewer_column := 'verified_by';
    v_reviewed_at_column := 'verified_at';
    v_reason_column := 'rejection_reason';
    v_target_type := 'driver_document';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;
  ELSIF p_document_family = 'vehicle' THEN
    v_table := 'vehicle_documents';
    v_status_column := 'status';
    v_reviewer_column := 'verified_by';
    v_reviewed_at_column := 'verified_at';
    v_reason_column := 'rejection_reason';
    v_target_type := 'vehicle_document';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;
  ELSIF p_document_family = 'company' THEN
    v_table := 'company_documents';
    v_status_column := 'status';
    v_reviewer_column := 'reviewed_by';
    v_reviewed_at_column := 'reviewed_at';
    v_reason_column := 'review_notes';
    v_target_type := 'company_document';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;
  ELSE
    v_table := 'driver_identity_documents';
    v_status_column := 'verification_status';
    v_reviewer_column := 'reviewed_by';
    v_reviewed_at_column := 'reviewed_at';
    v_reason_column := 'review_notes';
    v_target_type := 'identity_document';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'verified' ELSE 'rejected' END;
  END IF;

  v_target_name := format('%s document %s', p_document_family, p_document_id);

  EXECUTE format(
    'SELECT %1$I FROM public.%2$I WHERE id = $1 FOR UPDATE',
    v_status_column,
    v_table
  )
  INTO v_old_status
  USING p_document_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002';
  END IF;

  v_reason := CASE
    WHEN p_action = 'reject' THEN COALESCE(NULLIF(trim(p_reason), ''), 'Rejected by platform compliance review.')
    ELSE NULL
  END;

  EXECUTE format(
    'UPDATE public.%1$I
     SET %2$I = $2,
         %3$I = $3,
         %4$I = now(),
         %5$I = $4
     WHERE id = $1',
    v_table,
    v_status_column,
    v_reviewer_column,
    v_reviewed_at_column,
    v_reason_column
  )
  USING p_document_id, v_next_status, p_actor_user_id, v_reason;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_id,
    target_name,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    metadata
  )
  VALUES (
    p_actor_user_id,
    v_target_type,
    p_document_id,
    v_target_name,
    NULL,
    CASE WHEN p_action = 'approve' THEN 'document_approved' ELSE 'document_rejected' END,
    v_old_status,
    v_next_status,
    COALESCE(NULLIF(trim(p_reason), ''), format('%s document %s %s by platform compliance.', p_document_family, p_document_id, v_next_status)),
    jsonb_build_object(
      'document_id', p_document_id,
      'document_family', p_document_family,
      'target_type', v_target_type,
      'target_name', v_target_name
    )
  );

  RETURN QUERY SELECT p_document_id, v_old_status, v_next_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_decide_fraud_review_case(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_action text,
  p_reason text
)
RETURNS TABLE (case_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case public.fraud_review_cases%ROWTYPE;
  v_next_status text;
  v_unresolved_count bigint;
  v_profile_status text;
  v_profile_rows bigint;
BEGIN
  IF p_action NOT IN ('investigate', 'clear', 'confirm', 'dismiss') THEN
    RAISE EXCEPTION 'Unsupported fraud-case action.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_case
  FROM public.fraud_review_cases case_row
  WHERE case_row.id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fraud review case not found.' USING ERRCODE = 'P0002';
  END IF;

  v_next_status := CASE p_action
    WHEN 'investigate' THEN 'investigating'
    WHEN 'clear' THEN 'cleared'
    WHEN 'confirm' THEN 'confirmed'
    ELSE 'dismissed'
  END;

  IF p_action = 'confirm' THEN
    IF v_case.subject_user_id IS NULL THEN
      RAISE EXCEPTION 'Fraud confirmation requires a canonical subject_user_id.'
        USING ERRCODE = '23514';
    END IF;

    SELECT profile.status
    INTO v_profile_status
    FROM public.profiles profile
    WHERE profile.user_id = v_case.subject_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fraud confirmation requires an existing canonical profile for the subject user.'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_case.status IN ('cleared', 'confirmed', 'dismissed')
     AND v_case.status <> v_next_status
  THEN
    RAISE EXCEPTION 'Fraud review case is already finalised as %.', v_case.status
      USING ERRCODE = '23505';
  END IF;

  IF v_case.status = v_next_status
     AND COALESCE(v_case.decision_reason, '') = COALESCE(p_reason, '')
  THEN
    IF p_action = 'confirm' AND v_profile_status IS DISTINCT FROM 'blocked' THEN
      RAISE EXCEPTION 'Fraud case is already confirmed but subject profile is not blocked.'
        USING ERRCODE = '23514';
    END IF;

    RETURN QUERY SELECT v_case.id, v_case.status, v_case.status;
    RETURN;
  END IF;

  UPDATE public.fraud_review_cases
  SET status = v_next_status,
      decision_reason = p_reason,
      assigned_to = p_actor_user_id,
      decided_by = CASE WHEN p_action = 'investigate' THEN NULL ELSE p_actor_user_id END,
      decided_at = CASE WHEN p_action = 'investigate' THEN NULL ELSE now() END,
      updated_at = now()
  WHERE id = v_case.id;

  IF v_case.onboarding_application_id IS NOT NULL THEN
    IF p_action = 'confirm' THEN
      UPDATE public.onboarding_applications
      SET risk_status = 'confirmed_fraud',
          risk_reason = p_reason,
          risk_updated_at = now(),
          risk_reviewed_by = p_actor_user_id,
          status = 'rejected',
          reviewed_at = now(),
          reviewed_by = p_actor_user_id,
          review_notes = p_reason
      WHERE id = v_case.onboarding_application_id;
    ELSIF p_action IN ('clear', 'dismiss') THEN
      SELECT count(*)
      INTO v_unresolved_count
      FROM public.fraud_review_cases other_case
      WHERE other_case.onboarding_application_id = v_case.onboarding_application_id
        AND other_case.id <> v_case.id
        AND other_case.status IN ('open', 'investigating', 'confirmed');

      IF v_unresolved_count = 0 THEN
        UPDATE public.onboarding_applications
        SET risk_status = 'clear',
            risk_reason = NULL,
            risk_updated_at = now(),
            risk_reviewed_by = p_actor_user_id
        WHERE id = v_case.onboarding_application_id;
      END IF;
    END IF;
  END IF;

  IF p_action = 'confirm' THEN
    UPDATE public.profiles
    SET status = 'blocked'
    WHERE user_id = v_case.subject_user_id;

    GET DIAGNOSTICS v_profile_rows = ROW_COUNT;
    IF v_profile_rows <> 1 THEN
      RAISE EXCEPTION 'Fraud confirmation expected exactly one canonical profile update, got %.', v_profile_rows
        USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    metadata
  )
  VALUES (
    p_actor_user_id,
    v_case.subject_company_id,
    format('fraud_case_%s', p_action),
    v_case.status,
    v_next_status,
    p_reason,
    jsonb_build_object(
      'fraud_case_id', v_case.id,
      'subject_user_id', v_case.subject_user_id,
      'onboarding_application_id', v_case.onboarding_application_id
    )
  );

  RETURN QUERY SELECT v_case.id, v_case.status, v_next_status;
END;
$$;

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
REVOKE ALL ON FUNCTION public.register_duplicate_document_fraud_case(uuid, uuid, uuid, uuid, uuid, text, text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_review_compliance_document(uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_missing_onboarding_documents(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_onboarding_compliance_ready(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_company_compliance_ready(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_duplicate_document_fraud_case(uuid, uuid, uuid, uuid, uuid, text, text, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_review_compliance_document(uuid, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
