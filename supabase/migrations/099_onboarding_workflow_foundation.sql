BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Onboarding application lifecycle and resumable token flow
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('broker_shipper', 'fleet_courier', 'owner_driver')),
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'in_progress',
      'submitted',
      'under_review',
      'compliance_review',
      'admin_approval',
      'approved',
      'rejected',
      'request_changes'
    )
  ),
  current_step text NOT NULL DEFAULT 'account_type_wizard',
  completion_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  token_hash text UNIQUE,
  token_expires_at timestamptz,
  token_activated_at timestamptz,
  token_last_sent_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  review_notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_applications_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS onboarding_applications_status_idx
  ON public.onboarding_applications(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS onboarding_applications_token_expiry_idx
  ON public.onboarding_applications(token_expires_at);

CREATE TABLE IF NOT EXISTS public.onboarding_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_application_id uuid NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_updated_at_onboarding_applications()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_onboarding_applications ON public.onboarding_applications;
CREATE TRIGGER trg_touch_updated_at_onboarding_applications
BEFORE UPDATE ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_onboarding_applications();

CREATE OR REPLACE FUNCTION public.log_onboarding_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.status, '') IS DISTINCT FROM COALESCE(OLD.status, '') THEN
    INSERT INTO public.onboarding_status_history (onboarding_application_id, old_status, new_status, reason, changed_by)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.review_notes,
      NEW.reviewed_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_onboarding_status_transition ON public.onboarding_applications;
CREATE TRIGGER trg_log_onboarding_status_transition
AFTER UPDATE ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.log_onboarding_status_transition();

ALTER TABLE public.onboarding_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'onboarding_applications' AND policyname = 'onboarding_applications_owner_select'
  ) THEN
    CREATE POLICY onboarding_applications_owner_select
      ON public.onboarding_applications
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'onboarding_applications' AND policyname = 'onboarding_applications_owner_insert'
  ) THEN
    CREATE POLICY onboarding_applications_owner_insert
      ON public.onboarding_applications
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'onboarding_applications' AND policyname = 'onboarding_applications_owner_update'
  ) THEN
    CREATE POLICY onboarding_applications_owner_update
      ON public.onboarding_applications
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'onboarding_status_history' AND policyname = 'onboarding_status_history_owner_select'
  ) THEN
    CREATE POLICY onboarding_status_history_owner_select
      ON public.onboarding_status_history
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.onboarding_applications oa
          WHERE oa.id = onboarding_status_history.onboarding_application_id
            AND oa.user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Company-level compliance documents model
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  onboarding_application_id uuid REFERENCES public.onboarding_applications(id) ON DELETE SET NULL,
  doc_type text NOT NULL CHECK (
    doc_type IN (
      'operator_licence',
      'public_liability',
      'goods_in_transit',
      'vehicle_insurance',
      'vat_registration',
      'company_registration'
    )
  ),
  file_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'expired')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  expiry_date date,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_documents_company_idx ON public.company_documents(company_id);
CREATE INDEX IF NOT EXISTS company_documents_status_idx ON public.company_documents(status);

CREATE OR REPLACE FUNCTION public.touch_updated_at_company_documents()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_company_documents ON public.company_documents;
CREATE TRIGGER trg_touch_updated_at_company_documents
BEFORE UPDATE ON public.company_documents
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_company_documents();

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'company_documents' AND policyname = 'company_documents_select_company_members'
  ) THEN
    CREATE POLICY company_documents_select_company_members
      ON public.company_documents
      FOR SELECT
      TO authenticated
      USING (company_id = public.auth_company_id());
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Driver legal identity extension (verification status separated from uploads)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS residential_address text,
  ADD COLUMN IF NOT EXISTS proof_of_address_path text,
  ADD COLUMN IF NOT EXISTS right_to_work_evidence_path text,
  ADD COLUMN IF NOT EXISTS visa_type text,
  ADD COLUMN IF NOT EXISTS immigration_status text,
  ADD COLUMN IF NOT EXISTS share_code text,
  ADD COLUMN IF NOT EXISTS settled_status boolean,
  ADD COLUMN IF NOT EXISTS pre_settled_status boolean,
  ADD COLUMN IF NOT EXISTS identity_verification_status text DEFAULT 'unverified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'drivers_identity_verification_status_chk'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_identity_verification_status_chk
      CHECK (identity_verification_status IN ('unverified', 'under_review', 'verified', 'rejected'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.owner_driver_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_application_id uuid NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
  registration text NOT NULL,
  make text,
  model text,
  payload text,
  dimensions text,
  tail_lift boolean,
  insurance_details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS owner_driver_vehicles_onboarding_idx
  ON public.owner_driver_vehicles(onboarding_application_id);

CREATE TABLE IF NOT EXISTS public.driver_identity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_application_id uuid NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (
    doc_type IN (
      'driving_licence',
      'cpc',
      'proof_of_address',
      'right_to_work',
      'visa_document',
      'insurance'
    )
  ),
  file_path text,
  upload_status text NOT NULL DEFAULT 'missing' CHECK (upload_status IN ('missing', 'uploaded')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'under_review', 'verified', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_identity_documents_onboarding_idx
  ON public.driver_identity_documents(onboarding_application_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at_generic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_owner_driver_vehicles ON public.owner_driver_vehicles;
CREATE TRIGGER trg_touch_updated_at_owner_driver_vehicles
BEFORE UPDATE ON public.owner_driver_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_touch_updated_at_driver_identity_documents ON public.driver_identity_documents;
CREATE TRIGGER trg_touch_updated_at_driver_identity_documents
BEFORE UPDATE ON public.driver_identity_documents
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_generic();

ALTER TABLE public.owner_driver_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_identity_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'owner_driver_vehicles' AND policyname = 'owner_driver_vehicles_owner_access'
  ) THEN
    CREATE POLICY owner_driver_vehicles_owner_access
      ON public.owner_driver_vehicles
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.onboarding_applications oa
          WHERE oa.id = owner_driver_vehicles.onboarding_application_id
            AND oa.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.onboarding_applications oa
          WHERE oa.id = owner_driver_vehicles.onboarding_application_id
            AND oa.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'driver_identity_documents' AND policyname = 'driver_identity_documents_owner_access'
  ) THEN
    CREATE POLICY driver_identity_documents_owner_access
      ON public.driver_identity_documents
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.onboarding_applications oa
          WHERE oa.id = driver_identity_documents.onboarding_application_id
            AND oa.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.onboarding_applications oa
          WHERE oa.id = driver_identity_documents.onboarding_application_id
            AND oa.user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket for onboarding file uploads
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('onboarding-documents', 'onboarding-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Automatic backfill/repair for broken existing accounts
-- ─────────────────────────────────────────────────────────────────────────────

WITH missing_memberships AS (
  SELECT c.id AS company_id, c.created_by AS user_id
  FROM public.companies c
  LEFT JOIN public.company_memberships cm
    ON cm.company_id = c.id
   AND cm.user_id = c.created_by
   AND cm.status = 'active'
  WHERE c.created_by IS NOT NULL
    AND cm.id IS NULL
)
INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status)
SELECT company_id, user_id, 'owner', 'active'
FROM missing_memberships
ON CONFLICT DO NOTHING;

UPDATE public.profiles p
SET company_id = c.id,
    updated_at = now()
FROM public.companies c
WHERE c.created_by = p.user_id
  AND p.company_id IS NULL;

WITH account_source AS (
  SELECT
    u.id AS user_id,
    COALESCE(NULLIF(u.email, ''), 'unknown@xdrive.local') AS email,
    CASE
      WHEN COALESCE((u.raw_user_meta_data->>'account_type'), '') IN ('owner_driver', 'owner-driver', 'sole_trader')
           OR COALESCE(p.is_driver, false) = true
        THEN 'owner_driver'
      WHEN COALESCE((u.raw_user_meta_data->>'account_type'), '') IN ('company_admin', 'fleet_courier', 'fleet/courier')
        THEN 'fleet_courier'
      ELSE 'broker_shipper'
    END AS account_type,
    LOWER(COALESCE(c.status::text, 'pending_approval')) AS company_status
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.companies c ON c.created_by = u.id
  WHERE u.email_confirmed_at IS NOT NULL
)
INSERT INTO public.onboarding_applications (
  user_id,
  email,
  account_type,
  status,
  current_step,
  completion_percentage,
  token_hash,
  token_expires_at,
  token_activated_at,
  last_activity_at,
  payload,
  created_at,
  updated_at
)
SELECT
  s.user_id,
  s.email,
  s.account_type,
  CASE
    WHEN s.company_status = 'active' THEN 'approved'
    WHEN s.company_status = 'rejected' THEN 'rejected'
    WHEN s.company_status IN ('pending', 'pending_approval', 'under_review') THEN 'under_review'
    ELSE 'in_progress'
  END AS status,
  CASE
    WHEN s.company_status = 'active' THEN 'workspace_unlocked'
    WHEN s.company_status = 'rejected' THEN 'rejected'
    ELSE 'document_upload'
  END AS current_step,
  CASE
    WHEN s.company_status = 'active' THEN 100
    WHEN s.company_status = 'rejected' THEN 100
    ELSE 45
  END AS completion_percentage,
  NULL,
  NULL,
  now(),
  now(),
  jsonb_build_object('backfilled', true),
  now(),
  now()
FROM account_source s
ON CONFLICT (user_id)
DO UPDATE SET
  email = EXCLUDED.email,
  account_type = EXCLUDED.account_type,
  last_activity_at = now(),
  updated_at = now(),
  payload = public.onboarding_applications.payload || jsonb_build_object('backfilled', true);

COMMIT;
