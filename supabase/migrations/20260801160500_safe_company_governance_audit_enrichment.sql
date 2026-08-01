-- Migration 20260801160500 — Safe rework: company-governance audit enrichment
--
-- Context: Migration 20260801153000_fix_company_governance_audit_target.sql was
-- blocked pending Production schema confirmation of owner_audit_log.
--
-- Production schema confirmed (2026-08-01):
--
--   column_name       | data_type                   | udt_name    | is_nullable | column_default
--   ------------------+-----------------------------+-------------+-------------+-----------------
--   id                | uuid                        | uuid        | NO          | gen_random_uuid()
--   target_type       | text                        | text        | NO          | null
--   target_id         | uuid                        | uuid        | YES         | null
--   target_name       | text                        | text        | YES         | null
--   metadata          | jsonb                       | jsonb       | YES         | null
--   created_at        | timestamp with time zone    | timestamptz | NO          | now()
--   actor_user_id     | uuid                        | uuid        | NO          | null
--   target_company_id | uuid                        | uuid        | YES         | null
--   action_type       | text                        | text        | YES         | null
--   old_status        | text                        | text        | YES         | null
--   new_status        | text                        | text        | NO          | ''::text
--   reason            | text                        | text        | NO          | ''::text
--
-- Decision per 20260801153000 decision matrix:
--   target_id is nullable (YES) → live function is fully correct; no bug fix needed.
--   This migration applies DIFF C as an observability enhancement only.
--
-- This migration SUPERSEDES 20260801153000_fix_company_governance_audit_target.sql.
-- That file MUST NOT be applied — it silently drops two live Production enum casts.
--
-- Differences from 20260801153000 (all three diffs resolved):
--   DIFF A preserved: SELECT c.status::text INTO v_old_status (::text cast retained)
--   DIFF B preserved: UPDATE ... SET status = $1::company_status (::company_status cast retained)
--   DIFF C applied:   target_id and target_name added to the owner_audit_log INSERT
--
-- No other behaviour is changed. SECURITY DEFINER, search_path, return type,
-- and grants are identical to the live Production body.

BEGIN;

-- ── 1. Validate canonical owner_audit_log target columns ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'owner_audit_log'
      AND column_name  = 'target_type'
      AND data_type    = 'text'
      AND is_nullable  = 'NO'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_type text NOT NULL must exist before applying 20260801160500.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name  = 'owner_audit_log'
      AND column_name = 'target_id'
      AND udt_name    = 'uuid'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_id uuid must exist before applying 20260801160500.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name  = 'owner_audit_log'
      AND column_name = 'target_name'
      AND data_type   = 'text'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_name text must exist before applying 20260801160500.'
      USING ERRCODE = '23514';
  END IF;
END $$;

-- ── 2. set_company_status_governance — add target_id and target_name ──────────
--
-- Observability enhancement: populates target_id and target_name in the audit
-- INSERT so company governance actions are fully traceable.
--
-- Both live Production enum casts are preserved:
--   DIFF A: SELECT c.status::text        (retained)
--   DIFF B: $1::company_status in UPDATE  (retained)
CREATE OR REPLACE FUNCTION public.set_company_status_governance(
  p_actor_user_id     uuid,
  p_target_company_id uuid,
  p_action_type       text,
  p_new_status        text,
  p_reason            text DEFAULT NULL
)
RETURNS TABLE (company_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_new_status text := lower(trim(COALESCE(p_new_status, '')));
  v_reason     text := COALESCE(NULLIF(trim(p_reason), ''), 'No reason provided.');
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required for governance status updates.'
      USING ERRCODE = '23502';
  END IF;

  -- DIFF A preserved: ::text cast required to assign company_status enum → text variable
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

  -- DIFF B preserved: ::company_status cast required for explicit text → enum coercion
  EXECUTE 'UPDATE public.companies SET status = $1::company_status WHERE id = $2'
  USING v_new_status, p_target_company_id;

  -- DIFF C applied: target_id and target_name now populated for full audit traceability
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

COMMIT;

NOTIFY pgrst, 'reload schema';
