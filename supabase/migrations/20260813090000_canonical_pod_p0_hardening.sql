-- Canonical POD P0 hardening
--
-- Goals:
-- - POD is mandatory before Delivered/Completed.
-- - Files live in private Supabase Storage; DB stores paths + structured audit metadata.
-- - Assigned Driver OR executing Fleet Owner/Admin/Finance may complete POD.
-- - Owner Driver is covered through active company ownership even if profile.role = driver.
-- - One canonical proof_of_delivery row per job.
-- - Disable the legacy completion invoice trigger; application invoicing remains Draft-only and gated.
--
-- IMPORTANT: this migration is intentionally additive/hardening-oriented and contains no destructive
-- cleanup of legacy base64 evidence. Legacy cleanup must happen only after verified storage migration.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. POD must be mandatory for all XDrive jobs going forward.
-- -----------------------------------------------------------------------------
ALTER TABLE public.jobs
  ALTER COLUMN pod_required SET DEFAULT true;

UPDATE public.jobs
SET pod_required = true
WHERE pod_required IS DISTINCT FROM true;

-- Keep commercial snapshots aligned when the column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_commercial_agreements'
      AND column_name = 'pod_required'
  ) THEN
    EXECUTE 'ALTER TABLE public.job_commercial_agreements ALTER COLUMN pod_required SET DEFAULT true';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Canonical structured POD record.
-- -----------------------------------------------------------------------------
ALTER TABLE public.proof_of_delivery
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_behalf_of_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_by_role text,
  ADD COLUMN IF NOT EXISTS completion_source text,
  ADD COLUMN IF NOT EXISTS completion_reason text,
  ADD COLUMN IF NOT EXISTS document_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS vehicle_ref text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_proof_of_delivery_job_id
  ON public.proof_of_delivery(job_id);

CREATE INDEX IF NOT EXISTS idx_proof_of_delivery_company_id
  ON public.proof_of_delivery(company_id);

CREATE INDEX IF NOT EXISTS idx_proof_of_delivery_assigned_driver_id
  ON public.proof_of_delivery(assigned_driver_id);

ALTER TABLE public.proof_of_delivery ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. Canonical authorization helpers.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_executing_company_id(p_job_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(j.awarded_carrier_company_id, j.assigned_company_id, j.company_id)
  FROM public.jobs j
  WHERE j.id = p_job_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_driver_manage_job_pod(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.drivers d ON d.id = j.assigned_driver_id
    WHERE j.id = p_job_id
      AND d.user_id = auth.uid()
      AND coalesce(d.app_access, true) = true
      AND lower(coalesce(d.status::text, 'active')) = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_job_pod(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.company_memberships cm
      ON cm.company_id = coalesce(j.awarded_carrier_company_id, j.assigned_company_id, j.company_id)
    JOIN public.companies c ON c.id = cm.company_id
    WHERE j.id = p_job_id
      AND cm.user_id = auth.uid()
      AND coalesce(cm.status, 'active') = 'active'
      AND cm.role_in_company IN ('owner', 'admin', 'finance')
      AND lower(coalesce(c.status::text, 'active')) = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_job_pod(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.can_driver_manage_job_pod(p_job_id)
    OR public.can_manage_job_pod(p_job_id)
    OR EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.company_memberships cm ON cm.user_id = auth.uid()
      WHERE j.id = p_job_id
        AND coalesce(cm.status, 'active') = 'active'
        AND cm.company_id IN (
          j.company_id,
          j.posted_by_company_id,
          j.assigned_company_id,
          j.awarded_carrier_company_id
        )
    );
$$;

REVOKE ALL ON FUNCTION public.job_executing_company_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_driver_manage_job_pod(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_job_pod(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_job_pod(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_executing_company_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_driver_manage_job_pod(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_job_pod(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_job_pod(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Replace legacy proof_of_delivery RLS with relationship-based rules.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS pod_insert_creator ON public.proof_of_delivery;
DROP POLICY IF EXISTS pod_select_company ON public.proof_of_delivery;
DROP POLICY IF EXISTS pod_select_driver ON public.proof_of_delivery;
DROP POLICY IF EXISTS pod_update_creator ON public.proof_of_delivery;
DROP POLICY IF EXISTS owner_select_all_pod ON public.proof_of_delivery;
DROP POLICY IF EXISTS owner_select_all_proof_of_delivery ON public.proof_of_delivery;
DROP POLICY IF EXISTS pod_select_relationship_v2 ON public.proof_of_delivery;
DROP POLICY IF EXISTS pod_insert_relationship_v2 ON public.proof_of_delivery;
DROP POLICY IF EXISTS pod_update_relationship_v2 ON public.proof_of_delivery;

CREATE POLICY pod_select_relationship_v2
ON public.proof_of_delivery
FOR SELECT TO authenticated
USING (public.can_view_job_pod(job_id));

CREATE POLICY pod_insert_relationship_v2
ON public.proof_of_delivery
FOR INSERT TO authenticated
WITH CHECK (
  (public.can_driver_manage_job_pod(job_id) OR public.can_manage_job_pod(job_id))
  AND created_by = auth.uid()
  AND completed_by_user_id = auth.uid()
  AND company_id = public.job_executing_company_id(job_id)
);

CREATE POLICY pod_update_relationship_v2
ON public.proof_of_delivery
FOR UPDATE TO authenticated
USING (public.can_driver_manage_job_pod(job_id) OR public.can_manage_job_pod(job_id))
WITH CHECK (
  (public.can_driver_manage_job_pod(job_id) OR public.can_manage_job_pod(job_id))
  AND completed_by_user_id = auth.uid()
  AND company_id = public.job_executing_company_id(job_id)
);

-- -----------------------------------------------------------------------------
-- 5. One private bucket/path convention for POD evidence.
--    pod-photos/{job_id}/photos/{filename}
--    pod-photos/{job_id}/documents/{filename}
--    pod-photos/{job_id}/signatures/{filename}
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pod-photos',
  'pod-photos',
  false,
  15728640,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf','application/octet-stream']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS pod_photos_insert_driver ON storage.objects;
DROP POLICY IF EXISTS pod_photos_insert_operator_for_accessible_job ON storage.objects;
DROP POLICY IF EXISTS pod_photos_insert_assigned_driver ON storage.objects;
DROP POLICY IF EXISTS pod_photos_select_admin ON storage.objects;
DROP POLICY IF EXISTS pod_photos_select_driver ON storage.objects;
DROP POLICY IF EXISTS pod_photos_select_job_owner_awarded_carrier_or_driver ON storage.objects;
DROP POLICY IF EXISTS pod_photos_select_assigned_driver ON storage.objects;
DROP POLICY IF EXISTS pod_photos_insert_relationship_v2 ON storage.objects;
DROP POLICY IF EXISTS pod_photos_select_relationship_v2 ON storage.objects;

CREATE POLICY pod_photos_insert_relationship_v2
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pod-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.can_driver_manage_job_pod(((storage.foldername(name))[1])::uuid)
    OR public.can_manage_job_pod(((storage.foldername(name))[1])::uuid)
  )
  AND (storage.foldername(name))[2] IN ('photos', 'documents', 'signatures')
);

CREATE POLICY pod_photos_select_relationship_v2
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pod-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_view_job_pod(((storage.foldername(name))[1])::uuid)
);

-- -----------------------------------------------------------------------------
-- 6. Canonical POD validity: recipient + stored signature + stored photo/document.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_job_pod_valid(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.proof_of_delivery p
    WHERE p.job_id = p_job_id
      AND nullif(btrim(coalesce(p.received_by, '')), '') IS NOT NULL
      AND nullif(btrim(coalesce(p.signature_url, '')), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM storage.objects so
        WHERE so.bucket_id = 'pod-photos'
          AND so.name = p.signature_url
      )
      AND (
        EXISTS (
          SELECT 1
          FROM unnest(coalesce(p.photo_urls, '{}'::text[])) AS photo_path
          JOIN storage.objects so
            ON so.bucket_id = 'pod-photos'
           AND so.name = photo_path
          WHERE nullif(btrim(photo_path), '') IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(p.document_urls, '{}'::text[])) AS document_path
          JOIN storage.objects so
            ON so.bucket_id = 'pod-photos'
           AND so.name = document_path
          WHERE nullif(btrim(document_path), '') IS NOT NULL
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_job_pod_valid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_job_pod_valid(uuid) TO authenticated, service_role;

-- Independent DB-level invariant. Never trust a client-side pod_required=false bypass.
CREATE OR REPLACE FUNCTION public.fn_require_canonical_pod_for_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_status text := lower(coalesce(NEW.status::text, ''));
  v_new_current text := lower(coalesce(NEW.current_status, ''));
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(coalesce(OLD.status::text, '')) ELSE '' END;
  v_old_current text := CASE WHEN TG_OP = 'UPDATE' THEN lower(coalesce(OLD.current_status, '')) ELSE '' END;
BEGIN
  IF (
      v_new_status IN ('delivered', 'completed')
      OR v_new_current IN ('delivered', 'completed')
    )
    AND NOT (
      v_old_status IN ('delivered', 'completed')
      OR v_old_current IN ('delivered', 'completed')
    )
    AND NOT public.is_job_pod_valid(NEW.id)
  THEN
    RAISE EXCEPTION 'POD incomplete: valid stored POD is required before Delivered/Completed.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_canonical_pod_for_delivery ON public.jobs;
CREATE TRIGGER trg_require_canonical_pod_for_delivery
BEFORE INSERT OR UPDATE OF status, current_status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_require_canonical_pod_for_delivery();

-- Fix the legacy MVP guardrail to use the canonical POD validator instead of
-- array_length(jsonb, ...), which is invalid for jobs.delivery_photos jsonb.
CREATE OR REPLACE FUNCTION public.fn_jobs_mvp_guardrails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_next text[];
  v_carrier_company_id uuid;
  v_issues text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_allowed_next := CASE OLD.status::text
        WHEN 'draft' THEN ARRAY['posted', 'cancelled', 'disputed']
        WHEN 'posted' THEN ARRAY['allocated', 'cancelled', 'disputed']
        WHEN 'allocated' THEN ARRAY['in_transit', 'cancelled', 'disputed']
        WHEN 'in_transit' THEN ARRAY['delivered', 'cancelled', 'disputed']
        WHEN 'delivered' THEN ARRAY[]::text[]
        WHEN 'cancelled' THEN ARRAY[]::text[]
        WHEN 'disputed' THEN ARRAY[]::text[]
        ELSE ARRAY[]::text[]
      END;

      IF NOT (NEW.status::text = ANY (v_allowed_next)) THEN
        RAISE EXCEPTION 'Invalid job status transition: % -> %', OLD.status, NEW.status;
      END IF;

      IF NEW.status::text = 'in_transit'
         AND (NEW.collection_photo_url IS NULL OR btrim(NEW.collection_photo_url) = '')
      THEN
        RAISE EXCEPTION 'Collection evidence incomplete: collection photo is required before moving to in_transit.';
      END IF;

      IF NEW.status::text = 'delivered' AND NOT public.is_job_pod_valid(NEW.id) THEN
        RAISE EXCEPTION 'POD incomplete: valid stored POD is required before delivery completion.';
      END IF;
    END IF;
  END IF;

  IF NEW.exchange_visibility = 'exchange'
     AND (TG_OP = 'INSERT' OR coalesce(OLD.exchange_visibility, '') <> 'exchange')
  THEN
    v_issues := public.company_compliance_issues(NEW.company_id, 'publish');
    IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Compliance blocked publish action: %', array_to_string(v_issues, ' ');
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)
  THEN
    IF NEW.status::text IN ('allocated', 'in_transit', 'delivered') THEN
      v_carrier_company_id := coalesce(NEW.awarded_carrier_company_id, NEW.company_id);
      v_issues := public.company_compliance_issues(v_carrier_company_id, 'execution');
      IF coalesce(array_length(v_issues, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Compliance blocked execution action: %', array_to_string(v_issues, ' ');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Audit trail for POD creation/correction.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pod_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid REFERENCES public.proof_of_delivery(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  source text,
  on_behalf_of_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pod_audit_events_job_id
  ON public.pod_audit_events(job_id, created_at DESC);

ALTER TABLE public.pod_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pod_audit_select_relationship_v2 ON public.pod_audit_events;
CREATE POLICY pod_audit_select_relationship_v2
ON public.pod_audit_events
FOR SELECT TO authenticated
USING (public.can_view_job_pod(job_id));

CREATE OR REPLACE FUNCTION public.fn_audit_proof_of_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.pod_audit_events (
    pod_id,
    job_id,
    actor_user_id,
    action,
    source,
    on_behalf_of_driver_id,
    reason,
    snapshot
  )
  VALUES (
    NEW.id,
    NEW.job_id,
    coalesce(NEW.completed_by_user_id, auth.uid()),
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    NEW.completion_source,
    NEW.on_behalf_of_driver_id,
    NEW.completion_reason,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_proof_of_delivery ON public.proof_of_delivery;
CREATE TRIGGER trg_audit_proof_of_delivery
AFTER INSERT OR UPDATE ON public.proof_of_delivery
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_proof_of_delivery();

-- -----------------------------------------------------------------------------
-- 8. Remove legacy DB auto-invoice path that can create duplicate/buyer invoices.
--    Canonical Draft generation remains in the application service after Delivered + valid POD.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_generate_invoice_on_job_completion ON public.jobs;

COMMENT ON FUNCTION public.is_job_pod_valid(uuid) IS
  'Canonical POD validator: recipient + stored signature + stored photo/document required.';
COMMENT ON FUNCTION public.can_manage_job_pod(uuid) IS
  'Allows executing company owner/admin/finance to complete POD, including Owner Driver ownership cases.';
COMMENT ON TABLE public.pod_audit_events IS
  'Immutable audit history for POD creation/corrections, including on-behalf-of driver provenance.';

NOTIFY pgrst, 'reload schema';

COMMIT;
