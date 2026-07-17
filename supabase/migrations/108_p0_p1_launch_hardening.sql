-- P0/P1 launch hardening: canonical onboarding submit helper, customer role repair,
-- direct-invite bid isolation, and bilateral dispute visibility.

CREATE OR REPLACE FUNCTION public.submit_onboarding_application(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_company_id uuid;
  v_company_name text;
  v_contact_email text;
  v_contact_phone text;
  v_address text;
  v_role text;
  v_next_status text;
BEGIN
  SELECT *
  INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
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

  INSERT INTO public.company_memberships (company_id, user_id, invited_email, role_in_company, status, updated_at)
  VALUES (v_company_id, v_app.user_id, v_contact_email, v_role, 'active', now())
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET invited_email = EXCLUDED.invited_email,
                role_in_company = EXCLUDED.role_in_company,
                status = 'active',
                updated_at = now();

  UPDATE public.profiles
  SET company_id = v_company_id,
      role = CASE
        WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
        WHEN v_app.account_type = 'owner_driver' THEN 'driver'
        ELSE role
      END,
      status = CASE WHEN v_app.account_type = 'customer_shipper' THEN 'active' ELSE status END,
      updated_at = now()
  WHERE user_id = v_app.user_id;

  v_next_status := CASE
    WHEN v_app.account_type = 'customer_shipper' THEN 'approved'
    WHEN v_app.account_type = 'broker_shipper' THEN 'under_review'
    ELSE 'submitted'
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
$$;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO service_role;

-- Existing customers created as viewer cannot post loads because jobs RLS requires operator role.
UPDATE public.company_memberships cm
SET role_in_company = 'admin', updated_at = now()
FROM public.onboarding_applications oa
WHERE oa.user_id = cm.user_id
  AND oa.account_type = 'customer_shipper'
  AND cm.role_in_company = 'viewer';

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS direct_invite_company_id uuid REFERENCES public.companies(id);

DROP POLICY IF EXISTS jobs_direct_invite_select ON public.jobs;
CREATE POLICY jobs_direct_invite_select
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    exchange_visibility = 'direct'
    AND direct_invite_company_id IS NOT NULL
    AND public.is_company_member(direct_invite_company_id)
  );

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND (
      (
        company_id IS NOT NULL
        AND public.is_company_member(company_id)
        AND EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = job_bids.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.user_id = auth.uid()
          AND d.company_id = job_bids.company_id
          AND d.status NOT IN ('suspended', 'inactive')
      )
      OR (
        company_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.role = 'driver'
            AND p.status = 'active'
        )
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_bids.job_id
        AND j.exchange_visibility IN ('exchange', 'direct')
        AND (job_bids.company_id IS NULL OR j.company_id <> job_bids.company_id)
        AND j.awarded_carrier_company_id IS NULL
        AND (
          j.exchange_visibility <> 'direct'
          OR (
            job_bids.company_id IS NOT NULL
            AND j.direct_invite_company_id = job_bids.company_id
          )
        )
    )
  );

DROP POLICY IF EXISTS job_disputes_select_awarded_or_owner_company ON public.job_disputes;
CREATE POLICY job_disputes_select_awarded_or_owner_company
  ON public.job_disputes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_disputes.job_id
        AND (
          public.is_company_member(j.company_id)
          OR (
            j.awarded_carrier_company_id IS NOT NULL
            AND public.is_company_member(j.awarded_carrier_company_id)
          )
        )
    )
  );
DROP POLICY IF EXISTS jobs_awarded_update_only_awarded_carrier ON public.jobs;
CREATE POLICY jobs_awarded_update_only_awarded_carrier
  ON public.jobs
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    awarded_carrier_company_id IS NULL
    OR public.is_company_operator(awarded_carrier_company_id)
  )
  WITH CHECK (
    awarded_carrier_company_id IS NULL
    OR public.is_company_operator(awarded_carrier_company_id)
  );
CREATE OR REPLACE FUNCTION public.guard_direct_invite_bid_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exchange_visibility text;
  v_direct_invite_company_id uuid;
BEGIN
  IF NEW.status = 'accepted' AND COALESCE(OLD.status, '') IS DISTINCT FROM 'accepted' THEN
    SELECT j.exchange_visibility, j.direct_invite_company_id
    INTO v_exchange_visibility, v_direct_invite_company_id
    FROM public.jobs j
    WHERE j.id = NEW.job_id;

    IF v_exchange_visibility = 'direct'
       AND (NEW.company_id IS NULL OR v_direct_invite_company_id IS DISTINCT FROM NEW.company_id) THEN
      RAISE EXCEPTION 'Cannot accept an uninvited bid for a direct-invite job.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_direct_invite_bid_acceptance ON public.job_bids;
CREATE TRIGGER trg_guard_direct_invite_bid_acceptance
  BEFORE UPDATE OF status ON public.job_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_direct_invite_bid_acceptance();
