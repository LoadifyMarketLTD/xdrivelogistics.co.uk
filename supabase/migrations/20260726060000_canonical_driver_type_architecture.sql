-- ============================================================
-- ARCHITECTURE DECISION (canonical – do not override without
-- explicit product-owner sign-off):
--
-- XDrive Logistics supports exactly TWO driver types:
--   • owner_driver  – self-employed / sole-trader operator
--   • company_driver – employed by or contracted to a carrier
--
-- 'individual_driver' and 'subcontractor' are NOT driver types
-- and must not be persisted in drivers.driver_type.
-- 'subcontractor' describes a commercial relationship, not a
-- driver classification.
--
-- MARKETPLACE ACCESS:
-- Both owner_driver AND company_driver MUST be able to:
--   view marketplace jobs, submit quotations, receive direct
--   jobs, accept jobs, and complete transport operations.
--
-- PERMISSION MODEL:
-- can_commercial_bid is an independent business flag and must
-- NOT be derived from driver_type alone.  A company_driver
-- acting on behalf of their fleet is a valid bidding entity.
-- Default is TRUE for both types.
--
-- PLATFORM SCOPE:
-- This platform supports owner-drivers, small fleets (3-5
-- drivers), medium fleets, and large carriers.
-- ============================================================

-- 1. Remap legacy driver_type values before tightening the constraint.
--    individual_driver  → owner_driver  (no employer company – self-operated)
--    subcontractor      → company_driver if they have a company_id,
--                         owner_driver  otherwise
UPDATE public.drivers
SET driver_type = 'owner_driver'
WHERE driver_type = 'individual_driver';

UPDATE public.drivers
SET driver_type = CASE
  WHEN company_id IS NOT NULL THEN 'company_driver'
  ELSE 'owner_driver'
END
WHERE driver_type = 'subcontractor';

-- 2. Drop the old check constraint that permitted the invalid types.
ALTER TABLE public.drivers
  DROP CONSTRAINT IF EXISTS drivers_driver_type_check;

-- 3. Add the canonical constraint: only owner_driver | company_driver.
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_driver_type_check
  CHECK (driver_type IN ('owner_driver', 'company_driver'));

-- 4. Fix can_commercial_bid:
--    • Change the column default to TRUE (architecture requires both
--      types to have marketplace access unless explicitly revoked).
--    • Enable bidding for any company_driver that was incorrectly
--      blocked because the previous migration defaulted to FALSE.
ALTER TABLE public.drivers
  ALTER COLUMN can_commercial_bid SET DEFAULT true;

UPDATE public.drivers
SET can_commercial_bid = true
WHERE driver_type = 'company_driver'
  AND can_commercial_bid = false;

-- 5. Update submit_individual_driver_onboarding so that any driver
--    row it creates (directly or via a later approval step) lands with
--    driver_type = 'owner_driver', not the retired 'individual_driver'.
--    The function itself does not INSERT into drivers; it only updates
--    profiles.  The approval function (review_onboarding_application_atomic)
--    inserts the drivers row.  We patch the approval function so that
--    account_type = 'individual_driver' provisions an owner_driver row.
CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (
  onboarding_application_id uuid,
  status text,
  company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app          public.onboarding_applications%ROWTYPE;
  v_status       text;
  v_company_id   uuid;
  v_driver_id    uuid;
  v_contact_phone text;
  v_contact_email text;
BEGIN
  IF p_action NOT IN ('approve', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'Invalid review action.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  v_status := CASE p_action
    WHEN 'approve'         THEN 'approved'
    WHEN 'reject'          THEN 'rejected'
    ELSE 'request_changes'
  END;

  v_company_id := v_app.company_id;
  IF v_company_id IS NULL AND v_app.account_type NOT IN ('owner_driver', 'individual_driver', 'customer_shipper') THEN
    SELECT c.id INTO v_company_id
    FROM public.companies c
    WHERE c.created_by = v_app.user_id
    ORDER BY c.created_at DESC
    LIMIT 1;
  END IF;

  UPDATE public.onboarding_applications
  SET status          = v_status,
      reviewed_by     = p_actor_user_id,
      reviewed_at     = now(),
      rejection_reason = CASE WHEN p_action = 'reject' THEN p_notes ELSE rejection_reason END,
      notes           = COALESCE(p_notes, notes),
      company_id      = COALESCE(v_company_id, v_app.company_id),
      last_activity_at = now()
  WHERE id = p_application_id;

  -- Provision driver row for owner_driver and individual_driver approvals.
  -- individual_driver maps to owner_driver (self-employed, no carrier company).
  IF p_action = 'approve'
     AND v_app.account_type IN ('owner_driver', 'individual_driver')
  THEN
    v_contact_phone := NULLIF(trim(v_app.payload->>'phone'), '');
    v_contact_email := COALESCE(NULLIF(trim(v_app.payload->>'email'), ''), v_app.email);

    SELECT id INTO v_driver_id
    FROM public.drivers
    WHERE user_id = v_app.user_id
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
        availability_status,
        driver_type,
        can_commercial_bid
      )
      VALUES (
        NULL,  -- owner/individual drivers have no employer company
        v_app.user_id,
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        v_contact_phone,
        v_contact_email,
        'active',
        true,
        true,
        'offline',
        'owner_driver',   -- canonical type; never 'individual_driver'
        true              -- marketplace access enabled by default
      )
      RETURNING id INTO v_driver_id;
    ELSE
      UPDATE public.drivers
      SET name            = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), name),
          full_name       = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), full_name),
          display_name    = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), display_name),
          phone           = COALESCE(v_contact_phone, phone),
          email           = COALESCE(v_contact_email, email),
          -- Ensure canonical type and bidding access on re-approval.
          driver_type     = CASE
                              WHEN driver_type IN ('individual_driver', 'subcontractor') THEN 'owner_driver'
                              ELSE COALESCE(driver_type, 'owner_driver')
                            END,
          can_commercial_bid = true,
          updated_at      = now()
      WHERE id = v_driver_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_app.id                                  AS onboarding_application_id,
    v_status                                  AS status,
    COALESCE(v_company_id, v_app.company_id)  AS company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) TO service_role;

-- 6. Notify PostgREST to reload the schema cache.
NOTIFY pgrst, 'reload schema';
