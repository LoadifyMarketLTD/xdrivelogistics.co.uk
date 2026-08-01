-- ============================================================
-- P0 CATCH-UP MIGRATION — drivers.driver_type + can_commercial_bid
--
-- ROOT CAUSE:
--   Production schema drift: migrations 20260725184000 and
--   20260726060000 were never applied to the live Supabase project.
--   As a result public.drivers is missing both columns, causing
--   every login to fail with:
--     GET /rest/v1/drivers?select=...driver_type,can_commercial_bid...
--     → 400 Bad Request (PostgreSQL 42703: column does not exist)
--     → application redirects to /forbidden
--
-- THIS MIGRATION:
--   Idempotently replays the effect of the two missing migrations
--   plus the function fix from 20260730140000, in a single atomic
--   transaction with explicit preflight and rollback semantics.
--   It is safe to apply when the columns already exist (all DDL
--   uses IF NOT EXISTS / DROP IF EXISTS guards).
--
-- PREREQUISITES (must be confirmed on the target environment):
--   • migrations 001 – 20260725183000 recorded in schema_migrations
--   • onboarding_applications has: user_id, account_type, updated_at, created_at
--   • job_bids has: job_id, company_id, status, bidder_user_id
--   • jobs has: id, status, exchange_visibility, direct_invite_company_id,
--               company_id, awarded_carrier_company_id
--   • public.set_company_status_governance function exists
--   • public.notification_events table exists
--
-- PRODUCTION SAFETY:
--   • REQUIRES explicit Platform Owner approval before execution.
--   • Validate on a staging/disposable environment first.
--   • The companion middleware fix (same PR) protects the auth
--     bootstrap during the window before this migration is applied.
--
-- SCOPE: consolidates
--   20260725184000_driver_commercial_bidding_controls.sql
--   20260726060000_canonical_driver_type_architecture.sql
--   20260730140000_fix_review_onboarding_application_atomic_conflict_target.sql
--   (only the driver_type / can_commercial_bid portions)
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- ── 0. Preflight: abort if any active driver row cannot be classified ──────────
-- This guard prevents silent data loss; review manually if it fires.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'P0 catch-up preflight failed: found drivers rows with NULL user_id. '
      'Review and repair before running this migration.';
  END IF;
END;
$$;

-- ── 1. Add driver_type column (nullable first to allow backfill) ───────────────
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS driver_type text;

-- ── 2. Backfill driver_type from onboarding_applications (latest record wins) ──
--    Canonical mapping (matches 20260726060000 canonical architecture):
--      individual_driver → owner_driver  (self-employed, no carrier company)
--      subcontractor     → company_driver if company_id IS NOT NULL
--                          owner_driver  otherwise
--      owner_driver      → owner_driver
--      fleet_courier / company_driver → company_driver
--      anything else     → company_driver if company_id IS NOT NULL
--                          owner_driver  otherwise
WITH latest_onboarding AS (
  SELECT DISTINCT ON (oa.user_id)
    oa.user_id,
    oa.account_type
  FROM public.onboarding_applications oa
  WHERE oa.user_id IS NOT NULL
  ORDER BY oa.user_id, oa.updated_at DESC NULLS LAST, oa.created_at DESC NULLS LAST
)
UPDATE public.drivers d
SET driver_type = CASE
  WHEN lo.account_type IN ('individual_driver', 'owner_driver') THEN 'owner_driver'
  WHEN lo.account_type = 'subcontractor' THEN
    CASE WHEN d.company_id IS NOT NULL THEN 'company_driver' ELSE 'owner_driver' END
  WHEN lo.account_type IN ('fleet_courier', 'company_driver') THEN 'company_driver'
  ELSE
    CASE WHEN d.company_id IS NULL THEN 'owner_driver' ELSE 'company_driver' END
END
FROM latest_onboarding lo
WHERE lo.user_id = d.user_id
  AND (
    d.driver_type IS NULL
    OR d.driver_type NOT IN ('owner_driver', 'company_driver')
  );

-- ── 3. Backfill any remaining drivers not in onboarding_applications ──────────
UPDATE public.drivers d
SET driver_type = CASE
  WHEN d.company_id IS NULL THEN 'owner_driver'
  ELSE 'company_driver'
END
WHERE d.driver_type IS NULL
   OR d.driver_type NOT IN ('owner_driver', 'company_driver');

-- ── 4. Enforce canonical check constraint (owner_driver | company_driver only) ─
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_driver_type_check;
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_driver_type_check
  CHECK (driver_type IN ('owner_driver', 'company_driver'));

-- ── 5. Lock in the NOT NULL constraint and canonical default ─────────────────
ALTER TABLE public.drivers ALTER COLUMN driver_type SET DEFAULT 'company_driver';
ALTER TABLE public.drivers ALTER COLUMN driver_type SET NOT NULL;

-- ── 6. Add can_commercial_bid column with canonical default = true ─────────────
--    Architecture decision (20260726060000): both owner_driver and company_driver
--    must be able to bid on marketplace jobs unless explicitly revoked.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS can_commercial_bid boolean NOT NULL DEFAULT true;

-- ── 7. Enable bidding for any existing rows that were inserted with false ───────
--    (Safe no-op if the column was just created with DEFAULT true above.)
UPDATE public.drivers
SET can_commercial_bid = true
WHERE can_commercial_bid = false;

-- ── 8. Marketplace uniqueness indexes on job_bids ─────────────────────────────
--    (Originally in 20260725184000; IF NOT EXISTS makes these idempotent.)
CREATE UNIQUE INDEX IF NOT EXISTS job_bids_active_company_unique_idx
  ON public.job_bids (job_id, company_id)
  WHERE company_id IS NOT NULL AND status IN ('submitted', 'accepted');

CREATE UNIQUE INDEX IF NOT EXISTS job_bids_active_null_company_unique_idx
  ON public.job_bids (job_id, bidder_user_id)
  WHERE company_id IS NULL AND status IN ('submitted', 'accepted');

-- ── 9. Update job_bids exchange-insert RLS policy to gate on can_commercial_bid ─
DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.user_id = auth.uid()
        AND d.app_access = true
        AND COALESCE(d.status::text, '') = 'active'
        AND d.can_commercial_bid = true
        AND (
          d.company_id = job_bids.company_id
          OR (d.company_id IS NULL AND job_bids.company_id IS NULL)
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_bids.job_id
        AND j.status = 'posted'
        AND j.awarded_carrier_company_id IS NULL
        AND (
          j.exchange_visibility = 'exchange'
          OR (
            j.exchange_visibility = 'direct'
            AND job_bids.company_id IS NOT NULL
            AND j.direct_invite_company_id = job_bids.company_id
          )
        )
        AND (job_bids.company_id IS NULL OR j.company_id <> job_bids.company_id)
    )
  );

-- ── 10. Update review_onboarding_application_atomic to write canonical columns ─
--     Uses the version from 20260730140000 (explicit conflict-target hotfix).
--     CREATE OR REPLACE is idempotent.
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

  -- Resolve company: prefer the stored company_id, then look up by creator.
  -- owner_driver and individual_driver may legitimately have no company at
  -- review time (self-employed applicants without a linked workspace).
  v_company_id := v_app.company_id;
  IF v_company_id IS NULL THEN
    SELECT c.id INTO v_company_id
    FROM public.companies c
    WHERE c.created_by = v_app.user_id
    ORDER BY c.created_at DESC
    LIMIT 1;
  END IF;

  -- Activate the company and ensure owner membership for all non-owner-driver
  -- account types that have a linked company (fleet_courier, broker_shipper,
  -- customer_shipper, etc.).  owner_driver company activation is also performed
  -- here so their sole-trader workspace is active before they access the app.
  IF p_action = 'approve' AND v_company_id IS NOT NULL THEN
    PERFORM public.set_company_status_governance(
      p_actor_user_id,
      v_company_id,
      'company_approved',
      'active',
      COALESCE(NULLIF(trim(p_notes), ''), 'Onboarding approved')
    );

    INSERT INTO public.company_memberships
      (company_id, user_id, invited_email, role_in_company, status, updated_at)
    VALUES
      (v_company_id, v_app.user_id, v_app.email, 'owner', 'active', now())
    ON CONFLICT ON CONSTRAINT company_memberships_company_id_user_id_key
    DO UPDATE SET invited_email   = EXCLUDED.invited_email,
                  role_in_company = EXCLUDED.role_in_company,
                  status          = 'active',
                  updated_at      = now();
  END IF;

  -- Persist review outcome.  review_notes is the canonical column; the table
  -- has no rejection_reason or bare notes column.
  UPDATE public.onboarding_applications
  SET status          = v_status,
      reviewed_by     = p_actor_user_id,
      reviewed_at     = now(),
      review_notes    = COALESCE(p_notes, review_notes),
      company_id      = COALESCE(v_company_id, v_app.company_id),
      current_step    = CASE WHEN v_status = 'approved' THEN 'workspace_unlocked' ELSE 'pending_review' END,
      completion_percentage = CASE WHEN v_status = 'approved' THEN 100 ELSE completion_percentage END,
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

  -- Emit notification so the applicant is informed of the review outcome.
  INSERT INTO public.notification_events
    (event_type, entity_type, entity_id, company_id, recipient_user_id, payload)
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

  RETURN QUERY
  SELECT
    v_app.id                                  AS onboarding_application_id,
    v_status                                  AS status,
    COALESCE(v_company_id, v_app.company_id)  AS company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) TO service_role;

COMMIT;

-- PostgREST schema cache reload must fire after the transaction commits.
NOTIFY pgrst, 'reload schema';
