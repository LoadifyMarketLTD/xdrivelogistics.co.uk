-- ============================================================
-- Migration 103 — Canonical Award Path (P0-002 Remediation)
-- ============================================================
-- This migration fixes the following critical issues found in
-- the forensic review of the broker award workflow:
--
-- 1. `awarded_carrier_company_id` was overloaded — used for both
--    "directly invited carrier" (pre-award) and "actual award winner".
--    → Split into `direct_invite_company_id` (invite target) and
--      `awarded_carrier_company_id` (real award winner).
--
-- 2. `accept_job_bid_atomic` skipped the `awarded` stage and
--    immediately transitioned to `allocated` for all carriers.
--    → Now stops at `awarded` unless the carrier has a sole
--      owner-driver (auto-assign path only for single-driver firms).
--
-- 3. `accept_job_bid_atomic` only authorised company members with
--    owner/admin/dispatcher roles, blocking the customer award path
--    (customer is `created_by` of the job but may not be in
--    company_memberships with a decision role).
--    → Also accept the job's `created_by` user as an authorised actor.
--
-- 4. The atomic function wrote no `job_tracking_events` audit record.
--    → Now inserts an `awarded` tracking event atomically.
--
-- 5. `job_tracking_events` had no `meta`/`message` columns, so the
--    customer award route's extra context was silently dropped.
--    → Add `message text` and `meta jsonb` columns.
--
-- ============================================================

BEGIN;

-- ── 1. Add direct_invite_company_id to jobs ──────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS direct_invite_company_id uuid
    REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_direct_invite_company_idx
  ON public.jobs (direct_invite_company_id)
  WHERE direct_invite_company_id IS NOT NULL;

-- ── 2. Backfill: migrate pre-award direct invites to the new column ───────────
-- Jobs where exchange_visibility = 'direct' AND the job is still in a
-- pre-award status had awarded_carrier_company_id set to the invite target.
-- Move those to direct_invite_company_id and clear the overloaded field.
UPDATE public.jobs
SET
  direct_invite_company_id   = awarded_carrier_company_id,
  awarded_carrier_company_id = NULL
WHERE exchange_visibility        = 'direct'
  AND awarded_carrier_company_id IS NOT NULL
  AND status IN ('posted', 'quoted');

-- ── 3. Extend tracking_event_type enum with 'awarded' ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel  = 'awarded'
      AND enumtypid  = (
        SELECT oid FROM pg_type
        WHERE typname      = 'tracking_event_type'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      )
  ) THEN
    ALTER TYPE public.tracking_event_type ADD VALUE 'awarded';
  END IF;
END;
$$;

-- ── 4. Add message / meta columns to job_tracking_events ─────────────────────
ALTER TABLE public.job_tracking_events
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS meta    jsonb;

-- ── 5. RLS: direct-invite visibility for the target carrier ──────────────────
-- Carrier members can see a job if their company is the direct-invite target.
DROP POLICY IF EXISTS jobs_direct_invite_select ON public.jobs;
CREATE POLICY jobs_direct_invite_select ON public.jobs
  FOR SELECT
  USING (
    direct_invite_company_id IS NOT NULL
    AND public.is_company_member(direct_invite_company_id)
  );

-- ── 6. Canonical accept_job_bid_atomic ───────────────────────────────────────
-- Changes vs previous version:
--   a) Accepts job.created_by as an authorised actor (customer award path).
--   b) Only auto-transitions to 'allocated' when the winning carrier has
--      exactly one app-access driver (owner-driver solo firm pattern).
--      All other carriers stop at 'awarded' so the dispatcher assigns.
--   c) Inserts a job_tracking_events audit record (event_type = 'awarded').
CREATE OR REPLACE FUNCTION public.accept_job_bid_atomic(
  p_bid_id       uuid,
  p_actor_user_id uuid
)
RETURNS TABLE (
  success                    boolean,
  http_status                integer,
  error_code                 text,
  error_message              text,
  bid_id                     uuid,
  job_id                     uuid,
  awarded_carrier_company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id                     uuid;
  v_job_company_id             uuid;
  v_job_created_by             uuid;
  v_bid_company_id             uuid;
  v_bid_status                 text;
  v_exchange_visibility        text;
  v_existing_awarded_company   uuid;
  v_actor_role                 text;
  v_accepted_count             integer;
  v_award_count                integer;
  v_allocate_count             integer;
  v_owner_driver_id            uuid;
  v_driver_count               integer;
  v_bid_issues                 text[];
BEGIN
  -- ── a. Lock and load bid + job ─────────────────────────────────────────────
  SELECT
    jb.job_id,
    j.company_id,
    j.created_by,
    jb.company_id,
    jb.status,
    j.exchange_visibility,
    j.awarded_carrier_company_id
  INTO
    v_job_id,
    v_job_company_id,
    v_job_created_by,
    v_bid_company_id,
    v_bid_status,
    v_exchange_visibility,
    v_existing_awarded_company
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id
  FOR UPDATE OF jb, j;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 404, 'NOT_FOUND', 'Bid not found.', NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- ── b. Authorisation ───────────────────────────────────────────────────────
  -- Authorised if the actor is:
  --   (i)  the job creator (customer award path), or
  --   (ii) an active company member with a bid-decision role.
  IF p_actor_user_id IS DISTINCT FROM v_job_created_by THEN
    SELECT cm.role_in_company
    INTO   v_actor_role
    FROM   public.company_memberships cm
    WHERE  cm.user_id   = p_actor_user_id
      AND  cm.company_id = v_job_company_id
      AND  cm.status     = 'active'
    LIMIT 1;

    IF v_actor_role IS NULL THEN
      RETURN QUERY SELECT false, 403, 'FORBIDDEN',
        'Forbidden — you are not a member of the job-owning company.',
        p_bid_id, v_job_id, NULL::uuid;
      RETURN;
    END IF;

    IF v_actor_role NOT IN ('owner', 'admin', 'dispatcher') THEN
      RETURN QUERY SELECT false, 403, 'FORBIDDEN',
        'Forbidden — insufficient role to accept bids.',
        p_bid_id, v_job_id, NULL::uuid;
      RETURN;
    END IF;
  END IF;

  -- ── c. Business guards ─────────────────────────────────────────────────────
  IF v_exchange_visibility NOT IN ('exchange', 'direct') THEN
    RETURN QUERY SELECT false, 400, 'BAD_REQUEST',
      'Bad request — this job is not on the exchange.',
      p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_status <> 'submitted' THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — only submitted bids can be accepted.',
      p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_existing_awarded_company IS NOT NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — this job has already been awarded to a carrier.',
      p_bid_id, v_job_id, v_existing_awarded_company;
    RETURN;
  END IF;

  IF v_bid_company_id IS NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — bid company is missing.',
      p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_company_id = v_job_company_id THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN',
      'Forbidden — cannot accept a bid placed by your own company.',
      p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  -- ── d. Compliance check on winning carrier ─────────────────────────────────
  v_bid_issues := public.company_compliance_issues(v_bid_company_id, 'award');
  IF coalesce(array_length(v_bid_issues, 1), 0) > 0 THEN
    RETURN QUERY SELECT false, 409, 'COMPLIANCE_BLOCKED',
      format('Compliance blocked award action: %s', array_to_string(v_bid_issues, ' ')),
      p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  -- ── e. Accept the winning bid ──────────────────────────────────────────────
  UPDATE public.job_bids
  SET status = 'accepted'
  WHERE id     = p_bid_id
    AND status = 'submitted';
  GET DIAGNOSTICS v_accepted_count = ROW_COUNT;

  IF v_accepted_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — bid is no longer in submitted status.',
      p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  -- ── f. Reject all other submitted bids for this job ───────────────────────
  UPDATE public.job_bids
  SET status = 'rejected'
  WHERE job_id = v_job_id
    AND id     <> p_bid_id
    AND status = 'submitted';

  -- ── g. Transition job to 'awarded' ─────────────────────────────────────────
  UPDATE public.jobs
  SET
    awarded_carrier_company_id = v_bid_company_id,
    status                     = 'awarded',
    status_history             = COALESCE(status_history, '[]'::jsonb)
                                   || jsonb_build_object(
                                        'status',    'awarded',
                                        'timestamp', to_char(now() AT TIME ZONE 'UTC',
                                                             'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                                        'bid_id',    p_bid_id,
                                        'awarded_by', p_actor_user_id,
                                        'awarded_carrier_company_id', v_bid_company_id
                                      ),
    updated_at                 = now()
  WHERE id                        = v_job_id
    AND awarded_carrier_company_id IS NULL
    AND status IN ('posted', 'quoted');
  GET DIAGNOSTICS v_award_count = ROW_COUNT;

  IF v_award_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — job is no longer in an awardable status.',
      p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  -- ── h. Audit: write tracking event ─────────────────────────────────────────
  INSERT INTO public.job_tracking_events
    (job_id, event_type, created_by, message, meta)
  VALUES (
    v_job_id,
    'awarded',
    p_actor_user_id,
    'Bid accepted — carrier awarded.',
    jsonb_build_object(
      'bid_id',                     p_bid_id,
      'awarded_by',                 p_actor_user_id,
      'awarded_carrier_company_id', v_bid_company_id
    )
  );

  -- ── i. Owner-driver auto-allocation ────────────────────────────────────────
  -- Only auto-advance to 'allocated' when the winning carrier is a sole
  -- owner-driver firm (exactly one app-access driver).  All other carriers
  -- must be explicitly allocated via the Fleet Diary dispatcher workflow.
  SELECT COUNT(*), MIN(d.id)
  INTO   v_driver_count, v_owner_driver_id
  FROM   public.drivers d
  WHERE  d.company_id = v_bid_company_id
    AND  d.app_access = true;

  IF v_driver_count = 1 AND v_owner_driver_id IS NOT NULL THEN
    UPDATE public.jobs
    SET
      status             = 'allocated',
      assigned_driver_id = v_owner_driver_id,
      status_history     = COALESCE(status_history, '[]'::jsonb)
                             || jsonb_build_object(
                                  'status',    'allocated',
                                  'timestamp', to_char(now() AT TIME ZONE 'UTC',
                                                       'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                                  'auto_assigned_driver_id', v_owner_driver_id
                                ),
      updated_at         = now()
    WHERE id     = v_job_id
      AND status = 'awarded';
    GET DIAGNOSTICS v_allocate_count = ROW_COUNT;

    IF v_allocate_count <> 1 THEN
      -- Non-fatal: job stays awarded; dispatcher can assign manually.
      NULL;
    END IF;
  END IF;

  RETURN QUERY SELECT true, 200, NULL::text, NULL::text, p_bid_id, v_job_id, v_bid_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

COMMIT;
