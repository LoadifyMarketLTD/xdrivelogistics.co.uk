-- PreLive P0/P1 authority closure: a commercial award may be made only by an
-- active owner/admin/dispatcher of an ACTIVE job-owning company.
--
-- Preserve the already-approved named-driver/company-only award implementation
-- as a private base. This wrapper adds only the missing company-state authority
-- boundary and does not alter allocation, compliance, bid or agreement semantics.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regprocedure(
       'public.accept_job_bid_atomic_award_authority_base_v1(uuid,uuid)'
     ) IS NULL
  THEN
    IF to_regprocedure('public.accept_job_bid_atomic(uuid,uuid)') IS NULL THEN
      RAISE EXCEPTION 'accept_job_bid_atomic(uuid,uuid) is required before award authority closure.'
        USING ERRCODE = '42883';
    END IF;

    ALTER FUNCTION public.accept_job_bid_atomic(uuid, uuid)
      RENAME TO accept_job_bid_atomic_award_authority_base_v1;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic_award_authority_base_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_job_bid_atomic(
  p_bid_id uuid,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), p_actor_user_id);
  v_owner_company_id uuid;
BEGIN
  -- Preserve the canonical base function's validation/error semantics for
  -- malformed or unauthenticated calls.
  IF p_bid_id IS NULL OR v_actor IS NULL THEN
    RETURN public.accept_job_bid_atomic_award_authority_base_v1(
      p_bid_id,
      p_actor_user_id
    );
  END IF;

  SELECT j.company_id
  INTO v_owner_company_id
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id;

  IF NOT FOUND THEN
    RETURN public.accept_job_bid_atomic_award_authority_base_v1(
      p_bid_id,
      p_actor_user_id
    );
  END IF;

  -- Lock both authority rows for the transaction so company suspension or
  -- membership deactivation cannot race between this boundary and the base
  -- function's atomic award update.
  PERFORM 1
  FROM public.company_memberships cm
  JOIN public.companies c ON c.id = cm.company_id
  WHERE cm.company_id = v_owner_company_id
    AND cm.user_id = v_actor
    AND COALESCE(cm.status::text, '') = 'active'
    AND COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin', 'dispatcher')
    AND COALESCE(c.status::text, '') = 'active'
  FOR SHARE OF cm, c;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'http_status', 403,
      'error_code', 'FORBIDDEN',
      'error_message', 'The job-owning company must be active and the actor must hold an active owner, admin or dispatcher membership.'
    );
  END IF;

  RETURN public.accept_job_bid_atomic_award_authority_base_v1(
    p_bid_id,
    p_actor_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid)
  TO service_role;

COMMENT ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) IS
  'Canonical award entrypoint: requires active owner/admin/dispatcher membership in an active job-owning company, then delegates to the private approved named-driver/company-only award implementation.';

NOTIFY pgrst, 'reload schema';
COMMIT;
