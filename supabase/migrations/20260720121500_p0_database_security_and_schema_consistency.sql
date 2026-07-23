-- P0 live database security and schema consistency repair.
-- Generated from the production schema/RLS/function/trigger inventories captured on 2026-07-20.
-- Apply on staging first. The migration is transactional and fails closed if legacy rows
-- contradict the canonical values expected by the application.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Fail before changing anything if unexpected legacy values have appeared since the audit.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE role_in_company::text NOT IN ('owner', 'admin', 'dispatcher', 'finance', 'member', 'viewer', 'driver')
  ) THEN
    RAISE EXCEPTION 'Unexpected company_memberships.role_in_company value detected.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE status::text NOT IN ('active', 'invited', 'disabled', 'suspended')
  ) THEN
    RAISE EXCEPTION 'Unexpected company_memberships.status value detected.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.drivers d
    LEFT JOIN public.companies c ON c.id = d.company_id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Orphan drivers.company_id rows detected.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.drivers d
    LEFT JOIN auth.users u ON u.id = d.user_id
    WHERE d.user_id IS NOT NULL
      AND u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Orphan drivers.user_id rows detected.';
  END IF;
END;
$$;

-- Canonical membership vocabulary used by API routes, RPCs and RLS.
ALTER TABLE public.company_memberships
  DROP CONSTRAINT IF EXISTS company_memberships_role_in_company_check;

ALTER TABLE public.company_memberships
  ADD CONSTRAINT company_memberships_role_in_company_check
  CHECK (
    role_in_company::text IN (
      'owner', 'admin', 'dispatcher', 'finance', 'member', 'viewer', 'driver'
    )
  ) NOT VALID;

ALTER TABLE public.company_memberships
  VALIDATE CONSTRAINT company_memberships_role_in_company_check;

ALTER TABLE public.company_memberships
  DROP CONSTRAINT IF EXISTS company_memberships_status_check;

ALTER TABLE public.company_memberships
  ADD CONSTRAINT company_memberships_status_check
  CHECK (status::text IN ('active', 'invited', 'disabled', 'suspended')) NOT VALID;

ALTER TABLE public.company_memberships
  VALIDATE CONSTRAINT company_memberships_status_check;

-- Enforce the missing driver relationships.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.drivers'::regclass
      AND conname = 'drivers_company_id_fkey'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.drivers'::regclass
      AND conname = 'drivers_user_id_fkey'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.drivers VALIDATE CONSTRAINT drivers_company_id_fkey;
ALTER TABLE public.drivers VALIDATE CONSTRAINT drivers_user_id_fkey;

-- RLS helpers must accept active memberships only. "disabled" and "invited"
-- must never be treated as active merely because they are not "suspended".
CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND c.status::text = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin')
      AND c.status::text = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_operator(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
      AND c.status::text = 'active'
      AND COALESCE(p.role, '') <> 'driver'
  );
$$;

REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_operator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated, service_role;

-- Align the tracking-event constraint with both operational driver states and
-- internal audit events used by the atomic assignment functions.
ALTER TABLE public.job_tracking_events
  DROP CONSTRAINT IF EXISTS job_tracking_events_event_type_check;

ALTER TABLE public.job_tracking_events
  ADD CONSTRAINT job_tracking_events_event_type_check
  CHECK (
    event_type::text IN (
      'created',
      'allocated',
      'awarded',
      'driver_en_route',
      'arrived_pickup',
      'collected',
      'in_transit',
      'arrived_delivery',
      'delivered',
      'failed',
      'cancelled',
      'note',
      'on_my_way_to_pickup',
      'on_site_pickup',
      'loaded',
      'on_my_way_to_delivery',
      'on_site_delivery'
    )
  ) NOT VALID;

ALTER TABLE public.job_tracking_events
  VALIDATE CONSTRAINT job_tracking_events_event_type_check;

-- Notification queue durability. Existing status values remain valid.
ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_attempt_count_nonnegative;

ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_attempt_count_nonnegative
  CHECK (attempt_count >= 0) NOT VALID;

ALTER TABLE public.notification_events
  VALIDATE CONSTRAINT notification_events_attempt_count_nonnegative;

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_idempotency_key_uidx
  ON public.notification_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_events_retry_queue_idx
  ON public.notification_events(status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');

-- Historical queue rows must not retain raw onboarding links or tokens.
UPDATE public.notification_events
SET payload = COALESCE(payload, '{}'::jsonb)
  - 'onboarding_url'
  - 'token'
  - 'raw_token'
  - 'onboarding_token'
WHERE payload ?| ARRAY['onboarding_url', 'token', 'raw_token', 'onboarding_token'];

-- Remove duplicate triggers produced by colliding historical migrations.
-- One canonical trigger for each responsibility is retained.
DROP TRIGGER IF EXISTS drivers_updated_at ON public.drivers;

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS set_invoice_number ON public.invoices;

DROP TRIGGER IF EXISTS set_updated_at_job_bids ON public.job_bids;
DROP TRIGGER IF EXISTS set_jobs_updated_at ON public.jobs;

-- Repair the live onboarding submission function against the real table shape.
CREATE OR REPLACE FUNCTION public.submit_onboarding_application(p_application_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_company_id uuid;
  v_company_name text;
  v_contact_email text;
  v_contact_phone text;
  v_address text;
  v_role text;
  v_next_status text;
  v_doc_type text;
  v_driver_id uuid;
BEGIN
  SELECT *
  INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() <> 'service_role' AND v_app.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden onboarding application.' USING ERRCODE = '42501';
  END IF;

  IF v_app.status NOT IN ('draft', 'in_progress', 'request_changes', 'submitted', 'under_review') THEN
    RAISE EXCEPTION 'Onboarding application cannot be submitted from status %.', v_app.status
      USING ERRCODE = '23514';
  END IF;

  v_company_name := COALESCE(
    NULLIF(trim(v_app.payload->>'company_name'), ''),
    NULLIF(trim(v_app.payload->>'legal_company_name'), ''),
    NULLIF(trim(v_app.payload->>'trading_name'), ''),
    NULLIF(trim(v_app.payload->>'full_name'), ''),
    split_part(v_app.email, '@', 1) || ' workspace'
  );
  v_contact_email := COALESCE(NULLIF(trim(v_app.payload->>'contact_email'), ''), NULLIF(trim(v_app.payload->>'email'), ''), v_app.email);
  v_contact_phone := COALESCE(NULLIF(trim(v_app.payload->>'contact_phone'), ''), NULLIF(trim(v_app.payload->>'phone'), ''), NULL);
  v_address := COALESCE(
    NULLIF(trim(v_app.payload->>'billing_address'), ''),
    NULLIF(trim(v_app.payload->>'registered_address'), ''),
    NULLIF(trim(v_app.payload->>'address'), ''),
    NULL
  );

  SELECT id
  INTO v_company_id
  FROM public.companies
  WHERE created_by = v_app.user_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (
      name,
      email,
      phone,
      address_line1,
      company_number,
      vat_number,
      status,
      company_type,
      created_by
    )
    VALUES (
      v_company_name,
      v_contact_email,
      v_contact_phone,
      v_address,
      NULLIF(trim(v_app.payload->>'company_number'), ''),
      NULLIF(trim(v_app.payload->>'vat_number'), ''),
      CASE WHEN v_app.account_type = 'customer_shipper' THEN 'active' ELSE 'pending_approval' END,
      CASE
        WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
        WHEN v_app.account_type = 'broker_shipper' THEN 'broker'
        WHEN v_app.account_type = 'fleet_courier' THEN 'carrier'
        WHEN v_app.account_type = 'owner_driver' THEN 'owner_driver'
        ELSE 'standard'
      END,
      v_app.user_id
    )
    RETURNING id INTO v_company_id;
  ELSE
    UPDATE public.companies
    SET name = v_company_name,
        email = v_contact_email,
        phone = v_contact_phone,
        address_line1 = v_address,
        company_number = COALESCE(NULLIF(trim(v_app.payload->>'company_number'), ''), company_number),
        vat_number = COALESCE(NULLIF(trim(v_app.payload->>'vat_number'), ''), vat_number)
    WHERE id = v_company_id;
  END IF;

  v_role := CASE WHEN v_app.account_type = 'customer_shipper' THEN 'admin' ELSE 'owner' END;

  INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status, updated_at)
  VALUES (v_company_id, v_app.user_id, v_role, 'active', now())
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role_in_company = EXCLUDED.role_in_company,
                status = 'active',
                updated_at = now();

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), NULLIF(trim(v_app.payload->>'contact_person'), ''), full_name),
      phone = COALESCE(v_contact_phone, phone),
      company_id = v_company_id,
      role = CASE
        WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
        WHEN v_app.account_type = 'owner_driver' THEN 'driver'
        ELSE role
      END,
      status = CASE WHEN v_app.account_type = 'customer_shipper' THEN 'active' ELSE status END,
      updated_at = now()
  WHERE user_id = v_app.user_id;

  IF v_app.account_type = 'fleet_courier' THEN
    UPDATE public.fleet_compliance_profiles
    SET legal_company_name = COALESCE(NULLIF(trim(v_app.payload->>'legal_company_name'), ''), v_company_name),
        trading_name = NULLIF(trim(v_app.payload->>'trading_name'), ''),
        company_number = NULLIF(trim(v_app.payload->>'company_number'), ''),
        vat_number = NULLIF(trim(v_app.payload->>'vat_number'), ''),
        registered_address = NULLIF(trim(v_app.payload->>'registered_address'), ''),
        trading_address = NULLIF(trim(v_app.payload->>'trading_address'), ''),
        contact_person = NULLIF(trim(v_app.payload->>'contact_person'), ''),
        compliance_contact = NULLIF(trim(v_app.payload->>'compliance_contact'), ''),
        transport_contact = NULLIF(trim(v_app.payload->>'transport_contact'), ''),
        updated_at = now()
    WHERE onboarding_application_id = v_app.id;

    IF NOT FOUND THEN
      INSERT INTO public.fleet_compliance_profiles (
        onboarding_application_id,
        user_id,
        legal_company_name,
        trading_name,
        company_number,
        vat_number,
        registered_address,
        trading_address,
        contact_person,
        compliance_contact,
        transport_contact
      )
      VALUES (
        v_app.id,
        v_app.user_id,
        COALESCE(NULLIF(trim(v_app.payload->>'legal_company_name'), ''), v_company_name),
        NULLIF(trim(v_app.payload->>'trading_name'), ''),
        NULLIF(trim(v_app.payload->>'company_number'), ''),
        NULLIF(trim(v_app.payload->>'vat_number'), ''),
        NULLIF(trim(v_app.payload->>'registered_address'), ''),
        NULLIF(trim(v_app.payload->>'trading_address'), ''),
        NULLIF(trim(v_app.payload->>'contact_person'), ''),
        NULLIF(trim(v_app.payload->>'compliance_contact'), ''),
        NULLIF(trim(v_app.payload->>'transport_contact'), '')
      );
    END IF;

    FOREACH v_doc_type IN ARRAY ARRAY['operator_licence','public_liability','goods_in_transit','vehicle_insurance','motor_fleet_insurance','vat_registration','company_registration'] LOOP
      INSERT INTO public.company_documents (company_id, onboarding_application_id, doc_type, status)
      VALUES (v_company_id, v_app.id, v_doc_type, 'pending')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  IF v_app.account_type = 'owner_driver' THEN
    SELECT id
    INTO v_driver_id
    FROM public.drivers
    WHERE user_id = v_app.user_id
      AND company_id = v_company_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_driver_id IS NULL THEN
      INSERT INTO public.drivers (
        company_id,
        user_id,
        name,
        full_name,
        display_name,
        phone,
        email,
        status,
        is_active,
        app_access,
        availability_status
      )
      VALUES (
        v_company_id,
        v_app.user_id,
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        v_contact_phone,
        v_contact_email,
        'active',
        true,
        false,
        'offline'
      )
      RETURNING id INTO v_driver_id;
    ELSE
      UPDATE public.drivers
      SET name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), name),
          full_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), full_name),
          display_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), display_name),
          phone = COALESCE(v_contact_phone, phone),
          email = COALESCE(v_contact_email, email),
          updated_at = now()
      WHERE id = v_driver_id;
    END IF;

    UPDATE public.owner_driver_compliance_profiles
    SET full_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        date_of_birth = NULLIF(trim(v_app.payload->>'date_of_birth'), '')::date,
        address = NULLIF(trim(v_app.payload->>'address'), ''),
        national_insurance_number = NULLIF(trim(v_app.payload->>'national_insurance_number'), ''),
        right_to_work_status = NULLIF(trim(v_app.payload->>'right_to_work_status'), ''),
        licence_number = NULLIF(trim(v_app.payload->>'licence_number'), ''),
        licence_expiry = NULLIF(trim(v_app.payload->>'licence_expiry'), '')::date,
        updated_at = now()
    WHERE onboarding_application_id = v_app.id;

    IF NOT FOUND THEN
      INSERT INTO public.owner_driver_compliance_profiles (
        onboarding_application_id,
        user_id,
        full_name,
        date_of_birth,
        address,
        national_insurance_number,
        right_to_work_status,
        licence_number,
        licence_expiry
      )
      VALUES (
        v_app.id,
        v_app.user_id,
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        NULLIF(trim(v_app.payload->>'date_of_birth'), '')::date,
        NULLIF(trim(v_app.payload->>'address'), ''),
        NULLIF(trim(v_app.payload->>'national_insurance_number'), ''),
        NULLIF(trim(v_app.payload->>'right_to_work_status'), ''),
        NULLIF(trim(v_app.payload->>'licence_number'), ''),
        NULLIF(trim(v_app.payload->>'licence_expiry'), '')::date
      );
    END IF;

    UPDATE public.owner_driver_vehicles
    SET registration = v_app.payload->>'registration',
        make = v_app.payload->>'make',
        model = v_app.payload->>'model',
        payload = v_app.payload->>'payload',
        dimensions = v_app.payload->>'dimensions',
        updated_at = now()
    WHERE onboarding_application_id = v_app.id;

    IF NOT FOUND THEN
      INSERT INTO public.owner_driver_vehicles (onboarding_application_id, registration, make, model, payload, dimensions)
      VALUES (v_app.id, v_app.payload->>'registration', v_app.payload->>'make', v_app.payload->>'model', v_app.payload->>'payload', v_app.payload->>'dimensions');
    END IF;

    FOREACH v_doc_type IN ARRAY ARRAY['driving_licence','cpc','proof_of_address','right_to_work','visa_document','insurance'] LOOP
      INSERT INTO public.driver_identity_documents (onboarding_application_id, doc_type, upload_status, verification_status)
      VALUES (v_app.id, v_doc_type, 'missing', 'unverified')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  v_next_status := CASE
    WHEN v_app.account_type = 'customer_shipper' THEN 'approved'
    ELSE 'under_review'
  END;

  UPDATE public.onboarding_applications
  SET status = v_next_status,
      company_id = v_company_id,
      current_step = CASE WHEN v_next_status = 'approved' THEN 'workspace_unlocked' ELSE 'pending_review' END,
      completion_percentage = 100,
      submitted_at = COALESCE(submitted_at, now()),
      last_activity_at = now()
  WHERE id = v_app.id;

  RETURN v_company_id;
END;
$function$
;

-- Repair atomic onboarding review against the real table shape.
CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic(p_application_id uuid, p_actor_user_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(onboarding_application_id uuid, status text, company_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_status text;
  v_company_id uuid;
BEGIN
  IF p_action NOT IN ('approve', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'Invalid review action.' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  v_status := CASE p_action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    ELSE 'request_changes'
  END;

  v_company_id := v_app.company_id;
  IF v_company_id IS NULL THEN
    SELECT c.id
    INTO v_company_id
    FROM public.companies c
    WHERE c.created_by = v_app.user_id
    ORDER BY c.created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF p_action = 'approve' AND v_company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot approve onboarding without a linked company.' USING ERRCODE = '23514';
  END IF;

  IF p_action = 'approve' THEN
    PERFORM public.set_company_status_governance(
      p_actor_user_id,
      v_company_id,
      'company_approved',
      'active',
      COALESCE(NULLIF(trim(p_notes), ''), 'Onboarding approved')
    );

    INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status, updated_at)
    VALUES (v_company_id, v_app.user_id, 'owner', 'active', now())
    ON CONFLICT (company_id, user_id)
    DO UPDATE SET role_in_company = EXCLUDED.role_in_company,
                  status = 'active',
                  updated_at = now();
  END IF;

  UPDATE public.onboarding_applications
  SET status = v_status,
      company_id = COALESCE(company_id, v_company_id),
      reviewed_at = now(),
      reviewed_by = p_actor_user_id,
      review_notes = p_notes,
      current_step = CASE WHEN v_status = 'approved' THEN 'workspace_unlocked' ELSE 'pending_review' END,
      completion_percentage = CASE WHEN v_status = 'approved' THEN 100 ELSE completion_percentage END,
      last_activity_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.notification_events (event_type, entity_type, entity_id, company_id, recipient_user_id, payload)
  VALUES (
    CASE WHEN v_status = 'approved' THEN 'onboarding_approved' ELSE 'onboarding_review_updated' END,
    'onboarding_application',
    p_application_id,
    v_company_id,
    v_app.user_id,
    jsonb_build_object(
      'onboarding_application_id', p_application_id,
      'action', p_action,
      'status', v_status,
      'notes', p_notes
    )
  );

  RETURN QUERY SELECT p_application_id, v_status, v_company_id;
END;
$function$
;

-- Repair driver assignment tracking insert (message column + allowed event values).
CREATE OR REPLACE FUNCTION public.assign_job_driver_atomic(p_job_id uuid, p_driver_id uuid, p_expected_assigned_driver_id uuid, p_actor_user_id uuid)
 RETURNS TABLE(job_id uuid, status text, current_status text, assigned_driver_id uuid, assigned_company_id uuid, awarded_carrier_company_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_allowed_company_id uuid;
  v_role text;
  v_driver_status text;
  v_next_status text;
  v_note text;
BEGIN
  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.assigned_driver_id IS NOT NULL
     AND v_job.assigned_driver_id IS NOT DISTINCT FROM p_driver_id
     AND p_expected_assigned_driver_id IS NOT NULL
     AND v_job.assigned_driver_id IS NOT DISTINCT FROM p_expected_assigned_driver_id THEN
    RETURN QUERY
    SELECT j.id, j.status::text, j.current_status::text, j.assigned_driver_id, j.assigned_company_id, j.awarded_carrier_company_id
    FROM public.jobs j
    WHERE j.id = p_job_id;
    RETURN;
  END IF;

  IF v_job.assigned_driver_id IS DISTINCT FROM p_expected_assigned_driver_id THEN
    RAISE EXCEPTION 'Job assignment changed while this request was in progress.' USING ERRCODE = '40001';
  END IF;

  v_allowed_company_id := COALESCE(v_job.awarded_carrier_company_id, v_job.company_id);

  SELECT cm.role_in_company
  INTO v_role
  FROM public.company_memberships cm
  WHERE cm.company_id = v_allowed_company_id
    AND cm.user_id = p_actor_user_id
    AND cm.status = 'active'
  LIMIT 1;

  IF v_role NOT IN ('owner', 'admin', 'dispatcher') THEN
    IF v_job.awarded_carrier_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only an operator of the awarded carrier can assign a driver after award.' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'Only an operator of the job owner company can assign a driver before award.' USING ERRCODE = '42501';
  END IF;

  IF p_driver_id IS NOT NULL THEN
    SELECT d.status
    INTO v_driver_status
    FROM public.drivers d
    WHERE d.id = p_driver_id
      AND d.company_id = v_allowed_company_id
    FOR UPDATE;

    IF v_driver_status IS NULL OR v_driver_status IN ('suspended', 'inactive', 'rejected') THEN
      RAISE EXCEPTION 'Driver is not active in the assignable company.' USING ERRCODE = '23514';
    END IF;
  END IF;

  v_next_status := v_job.status;
  IF p_driver_id IS NOT NULL AND lower(coalesce(v_job.status::text, '')) IN ('draft', 'posted', 'received', 'awarded', 'open') THEN
    v_next_status := 'allocated';
  ELSIF p_driver_id IS NULL AND lower(coalesce(v_job.status::text, '')) = 'allocated' THEN
    v_next_status := CASE WHEN v_job.awarded_carrier_company_id IS NOT NULL THEN 'awarded' ELSE 'posted' END;
  END IF;

  UPDATE public.jobs
  SET assigned_driver_id = p_driver_id,
      assigned_company_id = CASE WHEN p_driver_id IS NULL THEN NULL ELSE v_allowed_company_id END,
      status = v_next_status,
      current_status = v_next_status,
      updated_at = now()
  WHERE id = p_job_id;

  v_note := CASE WHEN p_driver_id IS NULL THEN 'Driver assignment cleared.' ELSE 'Driver assigned.' END;

  INSERT INTO public.job_tracking_events (job_id, event_type, created_by, message)
  VALUES (p_job_id, CASE WHEN p_driver_id IS NULL THEN 'note' ELSE 'allocated' END, p_actor_user_id, v_note);

  RETURN QUERY
  SELECT j.id, j.status::text, j.current_status::text, j.assigned_driver_id, j.assigned_company_id, j.awarded_carrier_company_id
  FROM public.jobs j
  WHERE j.id = p_job_id;
END;
$function$
;

-- Privileged RPCs are server-only. The repository calls these through
-- supabaseAdmin API routes; browser/anonymous execution is forbidden.
REVOKE ALL ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.assign_job_driver_atomic(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_job_driver_atomic(uuid, uuid, uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid)
  TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.cancel_unassigned_exchange_job_atomic(uuid, uuid, text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.cancel_unassigned_exchange_job_atomic(uuid, uuid, text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cancel_unassigned_exchange_job_atomic(uuid, uuid, text) TO service_role';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.delete_unbid_exchange_job_atomic(uuid, uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.delete_unbid_exchange_job_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.delete_unbid_exchange_job_atomic(uuid, uuid) TO service_role';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.request_awarded_job_cancellation_atomic(uuid, uuid, text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.request_awarded_job_cancellation_atomic(uuid, uuid, text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.request_awarded_job_cancellation_atomic(uuid, uuid, text) TO service_role';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.decide_awarded_job_cancellation_atomic(uuid, uuid, text, text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.decide_awarded_job_cancellation_atomic(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.decide_awarded_job_cancellation_atomic(uuid, uuid, text, text) TO service_role';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.safe_dedup_drivers(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.safe_dedup_drivers(uuid) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.safe_dedup_drivers(uuid) TO service_role';
  END IF;
END;
$$;

COMMENT ON COLUMN public.notification_events.idempotency_key IS
  'Stable producer key used to prevent duplicate queue events.';
COMMENT ON COLUMN public.notification_events.last_error IS
  'Last persistent delivery error. Never store credentials or onboarding tokens here.';

NOTIFY pgrst, 'reload schema';

COMMIT;
