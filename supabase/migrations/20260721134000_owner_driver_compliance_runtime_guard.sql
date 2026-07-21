BEGIN;

CREATE OR REPLACE FUNCTION public.owner_driver_compliance_current(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application public.onboarding_applications%ROWTYPE;
  v_required_docs text[] := ARRAY['driving_licence', 'proof_of_address', 'insurance', 'right_to_work'];
  v_right_to_work_status text;
  v_cpc_required boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT oa.*
  INTO v_application
  FROM public.onboarding_applications oa
  WHERE oa.user_id = p_user_id
    AND oa.account_type = 'owner_driver'
  ORDER BY oa.updated_at DESC
  LIMIT 1;

  -- Fleet-employed drivers do not have an owner-driver onboarding application;
  -- their company approval, driver status and app_access remain authoritative.
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_application.status <> 'approved' THEN
    RETURN false;
  END IF;

  v_right_to_work_status := lower(trim(COALESCE(v_application.payload ->> 'right_to_work_status', '')));
  IF NULLIF(trim(COALESCE(v_application.payload ->> 'visa_type', '')), '') IS NOT NULL
     OR NULLIF(trim(COALESCE(v_application.payload ->> 'visa_expiry', '')), '') IS NOT NULL
     OR v_right_to_work_status IN ('visa_required', 'share_code_required', 'pre_settled') THEN
    v_required_docs := array_append(v_required_docs, 'visa_document');
  END IF;

  v_cpc_required := lower(trim(COALESCE(v_application.payload ->> 'cpc_required', 'false'))) IN ('true', '1', 'yes');
  IF v_cpc_required THEN
    v_required_docs := array_append(v_required_docs, 'cpc');
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(v_required_docs) AS required_doc(doc_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.driver_identity_documents did
      WHERE did.onboarding_application_id = v_application.id
        AND did.doc_type = required_doc.doc_type
        AND did.file_path IS NOT NULL
        AND did.upload_status = 'uploaded'
        AND did.verification_status = 'verified'
        AND (did.expiry_date IS NULL OR did.expiry_date >= current_date)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_driver_access_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND d.status = 'active'
      AND d.app_access IS TRUE
      AND public.owner_driver_compliance_current(d.user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_job_driver_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
BEGIN
  IF NEW.assigned_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.assigned_driver_id IS NOT DISTINCT FROM OLD.assigned_driver_id THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_driver
  FROM public.drivers
  WHERE id = NEW.assigned_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assigned driver does not exist.' USING ERRCODE = '23503';
  END IF;

  IF COALESCE(v_driver.status, '') <> 'active' OR COALESCE(v_driver.app_access, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Driver is not approved for application access and cannot be assigned.' USING ERRCODE = '23514';
  END IF;

  IF v_driver.user_id IS NOT NULL AND NOT public.owner_driver_compliance_current(v_driver.user_id) THEN
    RAISE EXCEPTION 'Owner-driver compliance is missing, unverified or expired.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_owner_driver_document_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_application_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_application_id := OLD.onboarding_application_id;
  ELSE
    v_application_id := NEW.onboarding_application_id;
  END IF;

  SELECT oa.user_id
  INTO v_user_id
  FROM public.onboarding_applications oa
  WHERE oa.id = v_application_id
    AND oa.account_type = 'owner_driver';

  IF v_user_id IS NOT NULL THEN
    UPDATE public.drivers d
    SET app_access = public.owner_driver_compliance_current(v_user_id),
        updated_at = now()
    WHERE d.user_id = v_user_id
      AND d.status = 'active';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_owner_driver_document_access ON public.driver_identity_documents;
CREATE TRIGGER trg_sync_owner_driver_document_access
AFTER INSERT OR UPDATE OF file_path, upload_status, verification_status, expiry_date OR DELETE
ON public.driver_identity_documents
FOR EACH ROW
EXECUTE FUNCTION public.sync_owner_driver_document_access();

REVOKE ALL ON FUNCTION public.owner_driver_compliance_current(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_job_driver_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_owner_driver_document_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_driver_access_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_driver_access_allowed() TO authenticated;

COMMIT;
