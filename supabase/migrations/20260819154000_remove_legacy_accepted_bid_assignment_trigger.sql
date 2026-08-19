-- Remove the remote-only legacy assignment trigger that derives job assignment
-- directly from accepted_bid_id, then close the remaining fresh-replay function
-- drift proven by the local db-lint gate.
--
-- Canonical award semantics are owned by accept_job_bid_atomic:
-- - named Driver bid -> same eligible driver + canonical vehicle auto-allocated;
-- - company-only Fleet bid -> awarded/unallocated for dispatcher allocation.
--
-- The legacy trigger is a second mutation path that does not own the canonical
-- compliance/readiness/award checks and depends on the remote-only
-- job_bids.bidder_company_id compatibility column. Fresh PR #357 history does
-- not create it. Removing the trigger makes live/fresh converge on the RPC as
-- the single award/assignment authority without changing approved semantics.
--
-- Clean replay also exposes historical physical/function drift. Repairs below
-- are deliberately adaptive: live-proven Driver fields are materialised only
-- when missing; safe_dedup_drivers is repaired because its retired name fields
-- do not exist in live; the onboarding base role declaration is changed ONLY
-- when the actual membership column is the fresh company_role enum (live is
-- text and therefore remains byte-semantic unchanged); governance status writes
-- adapt to the physical companies.status type. No Workspace UI, award contract,
-- onboarding policy, RLS, or Finance behavior is changed.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP TRIGGER IF EXISTS trg_sync_job_assignment_from_accepted_bid ON public.jobs;

DO $$
BEGIN
  IF to_regprocedure('public.sync_job_assignment_from_accepted_bid()') IS NOT NULL THEN
    COMMENT ON FUNCTION public.sync_job_assignment_from_accepted_bid() IS
      'Legacy compatibility function retained for history only. Its jobs trigger is disabled; canonical award and named-driver/company-only assignment semantics are owned by accept_job_bid_atomic.';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Fresh/live Driver physical contract reconciliation.
-- Production evidence confirms all three columns already exist there, so this
-- block is a live no-op. Backfill runs only when clean replay actually creates a
-- missing column; existing live values are never rewritten.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_had_is_active boolean;
  v_had_name boolean;
  v_had_full_name boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'is_active'
  ) INTO v_had_is_active;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'name'
  ) INTO v_had_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'full_name'
  ) INTO v_had_full_name;

  IF NOT v_had_is_active THEN
    ALTER TABLE public.drivers
      ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT v_had_name THEN
    ALTER TABLE public.drivers ADD COLUMN name text;
    EXECUTE $sql$
      UPDATE public.drivers
      SET name = COALESCE(
        NULLIF(btrim(display_name), ''),
        NULLIF(btrim(email), ''),
        id::text
      )
      WHERE name IS NULL OR btrim(name) = ''
    $sql$;
    ALTER TABLE public.drivers ALTER COLUMN name SET NOT NULL;
  END IF;

  IF NOT v_had_full_name THEN
    ALTER TABLE public.drivers ADD COLUMN full_name text;
    EXECUTE $sql$
      UPDATE public.drivers
      SET full_name = COALESCE(
        NULLIF(btrim(display_name), ''),
        NULLIF(btrim(name), ''),
        NULLIF(btrim(email), ''),
        id::text
      )
      WHERE full_name IS NULL OR btrim(full_name) = ''
    $sql$;
    ALTER TABLE public.drivers ALTER COLUMN full_name SET NOT NULL;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Replace only the retired driver display-field references in the historical
-- dedup helper. Duplicate matching, open-job protection, deactivation and delete
-- semantics stay unchanged. Production still has a legacy jobs.driver_id column;
-- clean replay may not. Reading it through to_jsonb(row) preserves that extra
-- safety check when present without creating a compile-time dependency in fresh.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_dedup_drivers(p_keep_driver_id uuid)
RETURNS TABLE (deleted_id uuid, deleted_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_email text;
  v_phone text;
  v_user_id uuid;
  v_dup record;
BEGIN
  SELECT company_id, email, phone, user_id
    INTO v_company_id, v_email, v_phone, v_user_id
  FROM public.drivers
  WHERE id = p_keep_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver % not found', p_keep_driver_id
      USING ERRCODE = 'no_data_found';
  END IF;

  FOR v_dup IN
    SELECT
      d.id,
      COALESCE(
        NULLIF(btrim(d.display_name), ''),
        NULLIF(btrim(d.full_name), ''),
        NULLIF(btrim(d.name), ''),
        d.id::text
      ) AS driver_name,
      d.status
    FROM public.drivers d
    WHERE d.id <> p_keep_driver_id
      AND d.company_id = v_company_id
      AND (
           (v_email IS NOT NULL AND d.email = v_email)
        OR (v_phone IS NOT NULL AND d.phone = v_phone)
        OR (v_user_id IS NOT NULL AND d.user_id = v_user_id)
      )
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE (
           j.assigned_driver_id = v_dup.id
        OR (to_jsonb(j) ->> 'driver_id') = v_dup.id::text
      )
        AND (
             j.status IS NULL
          OR j.status::text NOT IN ('delivered', 'cancelled', 'disputed')
        )
    ) THEN
      RAISE EXCEPTION
        'Duplicate driver % (%) has open jobs and cannot be removed. Reassign jobs first.',
        v_dup.id,
        v_dup.driver_name
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    UPDATE public.drivers
    SET status = 'inactive'
    WHERE id = v_dup.id
      AND COALESCE(status::text, 'active') = 'active';

    DELETE FROM public.drivers WHERE id = v_dup.id;

    deleted_id := v_dup.id;
    deleted_name := v_dup.driver_name;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.safe_dedup_drivers(uuid) IS
  'Safely removes duplicate drivers sharing company identity fields after confirming no open assigned jobs; uses canonical driver display/name fields and preserves the live legacy jobs.driver_id safety check when that field exists.';

-- ---------------------------------------------------------------------------
-- The public submit wrapper renamed the previous canonical submit function to
-- submit_onboarding_application_base_v1. Clean replay currently stores
-- company_memberships.role_in_company as company_role, while live XDrive stores
-- it as text. Change the local declaration only for the enum-backed fresh shape;
-- on live text the function is intentionally left unchanged.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_oid oid;
  v_def text;
  v_role_data_type text;
  v_role_udt_name text;
BEGIN
  v_oid := to_regprocedure('public.submit_onboarding_application_base_v1(uuid)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'submit_onboarding_application_base_v1(uuid) must exist before fresh replay reconciliation.'
      USING ERRCODE = '42883';
  END IF;

  SELECT c.data_type, c.udt_name
  INTO v_role_data_type, v_role_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'company_memberships'
    AND c.column_name = 'role_in_company';

  IF v_role_data_type IS NULL THEN
    RAISE EXCEPTION 'company_memberships.role_in_company is missing.'
      USING ERRCODE = '42703';
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_def;

  IF v_role_data_type = 'USER-DEFINED' AND v_role_udt_name = 'company_role' THEN
    IF position('v_role text;' IN v_def) > 0 THEN
      v_def := replace(v_def, 'v_role text;', 'v_role public.company_role;');
      EXECUTE v_def;
    ELSIF position('v_role public.company_role;' IN v_def) = 0 THEN
      RAISE EXCEPTION 'Unexpected enum-backed submit_onboarding_application_base_v1 role declaration; refusing broad rewrite.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_role_data_type = 'text' THEN
    IF position('v_role text;' IN v_def) = 0 THEN
      RAISE EXCEPTION 'Unexpected live text-backed submit_onboarding_application_base_v1 role declaration; refusing rewrite.'
        USING ERRCODE = 'P0001';
    END IF;
    -- Live XDrive is already type-correct: leave its function definition alone.
  ELSE
    RAISE EXCEPTION 'Unsupported company_memberships.role_in_company type: %/%', v_role_data_type, v_role_udt_name
      USING ERRCODE = '42804';
  END IF;
END
$$;

-- Keep the preserved base implementation private exactly as the wrapper migration
-- requires. The SECURITY DEFINER public wrapper remains the only callable submit
-- path for authenticated/service-role callers.
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM service_role;

-- ---------------------------------------------------------------------------
-- Governance status writes must support the physical type that actually exists.
-- Clean history has companies.status=text; Production currently has
-- public.company_status. Build the cast from pg_attribute at runtime instead of
-- embedding a Production-only enum name that makes clean replay fail lint.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_company_status_governance(
  p_actor_user_id uuid,
  p_target_company_id uuid,
  p_action_type text,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (company_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_new_status text := lower(trim(COALESCE(p_new_status, '')));
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'No reason provided.');
  v_status_type text;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required for governance status updates.'
      USING ERRCODE = '23502';
  END IF;

  SELECT c.status::text
  INTO v_old_status
  FROM public.companies c
  WHERE c.id = p_target_company_id
  FOR UPDATE;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Company not found for governance status update.'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.assert_company_status_transition(v_old_status, v_new_status);
  PERFORM set_config('app.company_status_change_context', 'governance_api', true);

  SELECT format_type(a.atttypid, a.atttypmod)
  INTO v_status_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.companies'::regclass
    AND a.attname = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_status_type IS NULL THEN
    RAISE EXCEPTION 'companies.status physical type could not be resolved.'
      USING ERRCODE = '42703';
  END IF;

  EXECUTE format(
    'UPDATE public.companies SET status = $1::%s WHERE id = $2',
    v_status_type
  ) USING v_new_status, p_target_company_id;

  INSERT INTO public.owner_audit_log (
    target_type,
    target_id,
    target_name,
    target_company_id,
    actor_user_id,
    action_type,
    old_status,
    new_status,
    reason,
    created_at
  )
  VALUES (
    'company',
    p_target_company_id,
    format('Company %s', p_target_company_id),
    p_target_company_id,
    p_actor_user_id,
    p_action_type,
    lower(trim(v_old_status)),
    v_new_status,
    v_reason,
    now()
  );

  RETURN QUERY
  SELECT p_target_company_id, lower(trim(v_old_status)), v_new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
