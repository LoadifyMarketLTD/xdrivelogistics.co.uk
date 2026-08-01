-- Migration 20260801091000 — Narrow repair for marketplace owner_audit_log targets
--
-- Live production evidence confirmed the current P0 NOT NULL violation is emitted
-- by apply_marketplace_governance_action(uuid, uuid, text, text). The function's
-- audit INSERT omits target_type (and therefore also omits the available
-- target_id/target_name fields in the live schema).
--
-- This migration intentionally patches only that confirmed caller, while keeping
-- target_type NOT NULL with no empty-string fallback. It also requires the live
-- target_id uuid and target_name text columns to already exist instead of trying
-- to invent or backfill audit target semantics automatically.

BEGIN;

-- ── 1. Validate canonical owner_audit_log target columns ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'owner_audit_log'
      AND column_name  = 'target_type'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.owner_audit_log LIMIT 1) THEN
      RAISE EXCEPTION
        'owner_audit_log.target_type is missing on a non-empty table. Apply the canonical target columns first; this migration will not invent fallback target values.'
        USING ERRCODE = '23514';
    END IF;

    ALTER TABLE public.owner_audit_log
      ADD COLUMN target_type text NOT NULL;
  END IF;

  ALTER TABLE public.owner_audit_log
    ALTER COLUMN target_type DROP DEFAULT,
    ALTER COLUMN target_type SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_id'
      AND udt_name = 'uuid'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_id uuid must exist before applying 20260801091000_fix_owner_audit_log_target_type.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_name'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_name text must exist before applying 20260801091000_fix_owner_audit_log_target_type.'
      USING ERRCODE = '23514';
  END IF;
END $$;

-- ── 2. apply_marketplace_governance_action (migration 078) ───────────────────
CREATE OR REPLACE FUNCTION public.apply_marketplace_governance_action(
  p_actor_user_id uuid,
  p_job_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  status text,
  company_id uuid,
  exchange_visibility text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text := lower(trim(COALESCE(p_action, '')));
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'Marketplace governance action executed by owner.');
  v_current_status text;
  v_current_visibility text;
  v_company_id uuid;
  v_old_value text;
  v_new_value text;
  v_audit_action_type text;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required for marketplace governance updates.'
      USING ERRCODE = '23502';
  END IF;

  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'job_id is required for marketplace governance updates.'
      USING ERRCODE = '23502';
  END IF;

  IF v_action NOT IN ('publish_to_exchange', 'hide_from_exchange', 'force_dispute', 'force_cancel') THEN
    RAISE EXCEPTION 'Invalid marketplace governance action: %', v_action
      USING ERRCODE = '23514';
  END IF;

  SELECT
    lower(trim(j.status::text)),
    lower(trim(j.exchange_visibility::text)),
    j.company_id
  INTO
    v_current_status,
    v_current_visibility,
    v_company_id
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Marketplace job not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_action = 'publish_to_exchange' THEN
    IF v_current_status NOT IN ('draft', 'posted') THEN
      RAISE EXCEPTION 'Cannot publish job in "%" status to exchange.', v_current_status
        USING ERRCODE = '23514';
    END IF;
    IF v_current_visibility = 'exchange' THEN
      RAISE EXCEPTION 'Job is already visible on exchange.'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs AS job_row
    SET exchange_visibility = 'exchange',
        exchange_posted_at = now()
    WHERE job_row.id = p_job_id;

    v_old_value := 'visibility:' || v_current_visibility;
    v_new_value := 'visibility:exchange';
    v_audit_action_type := 'marketplace_published';
  ELSIF v_action = 'hide_from_exchange' THEN
    IF v_current_visibility <> 'exchange' THEN
      RAISE EXCEPTION 'Job visibility is "%", not exchange.', v_current_visibility
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs AS job_row
    SET exchange_visibility = 'private'
    WHERE job_row.id = p_job_id;

    v_old_value := 'visibility:exchange';
    v_new_value := 'visibility:private';
    v_audit_action_type := 'marketplace_hidden';
  ELSIF v_action = 'force_dispute' THEN
    IF v_current_status NOT IN ('draft', 'posted', 'allocated', 'in_transit') THEN
      RAISE EXCEPTION 'Cannot change status from "%".', v_current_status
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs AS job_row
    SET status = 'disputed'
    WHERE job_row.id = p_job_id;

    v_old_value := v_current_status;
    v_new_value := 'disputed';
    v_audit_action_type := 'marketplace_job_disputed';
  ELSE
    IF v_current_status NOT IN ('draft', 'posted', 'allocated', 'in_transit') THEN
      RAISE EXCEPTION 'Cannot change status from "%".', v_current_status
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs AS job_row
    SET status = 'cancelled'
    WHERE job_row.id = p_job_id;

    v_old_value := v_current_status;
    v_new_value := 'cancelled';
    v_audit_action_type := 'marketplace_job_cancelled';
  END IF;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_id,
    target_name,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    created_at
  )
  VALUES (
    p_actor_user_id,
    'job',
    p_job_id,
    format('Marketplace job %s', p_job_id),
    v_company_id,
    v_audit_action_type,
    v_old_value,
    v_new_value,
    v_reason,
    now()
  );

  RETURN QUERY
  SELECT
    j.id,
    j.status::text,
    j.company_id,
    j.exchange_visibility::text
  FROM public.jobs j
  WHERE j.id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
