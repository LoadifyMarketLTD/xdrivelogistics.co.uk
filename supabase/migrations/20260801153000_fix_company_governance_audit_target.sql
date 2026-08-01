-- Migration 20260801153000 — Narrow repair for company-governance owner_audit_log targets
--
-- !! DO NOT APPLY TO PRODUCTION — UNSAFE AS WRITTEN !!
--
-- Live Production function body captured 2026-08-01.
-- This migration MUST NOT be applied without first being reworked to preserve the
-- two live enum casts documented in the diff below.  Applying it as written would
-- silently drop those casts and risk breaking status updates on Production.
--
-- ── Live Production evidence (captured 2026-08-01) ─────────────────────────────
--
-- function_signature : set_company_status_governance(uuid,uuid,text,text,text)
-- returns            : TABLE(company_id uuid, old_status text, new_status text)
-- security_definer   : true
-- proc_config        : search_path=public
-- service_role       : EXECUTE granted
-- anon / authenticated: NOT granted
--
-- Live Production function body:
--
--   CREATE OR REPLACE FUNCTION public.set_company_status_governance(...)
--    RETURNS TABLE(company_id uuid, old_status text, new_status text)
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--   DECLARE
--     v_old_status text;
--     v_new_status text := lower(trim(COALESCE(p_new_status, '')));
--     v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'No reason provided.');
--   BEGIN
--     IF p_actor_user_id IS NULL THEN
--       RAISE EXCEPTION 'actor_user_id is required for governance status updates.'
--         USING ERRCODE = '23502';
--     END IF;
--
--     SELECT c.status::text                              -- ← ::text cast present in live
--     INTO v_old_status
--     FROM public.companies c
--     WHERE c.id = p_target_company_id
--     FOR UPDATE;
--
--     IF v_old_status IS NULL THEN
--       RAISE EXCEPTION 'Company not found for governance status update.'
--         USING ERRCODE = 'P0002';
--     END IF;
--
--     PERFORM public.assert_company_status_transition(v_old_status, v_new_status);
--     PERFORM set_config('app.company_status_change_context', 'governance_api', true);
--
--     EXECUTE 'UPDATE public.companies SET status = $1::company_status WHERE id = $2'
--     USING v_new_status, p_target_company_id;          -- ← ::company_status cast present in live
--
--     INSERT INTO public.owner_audit_log (
--       target_type,           -- ← already 'company' in live; NOT a missing column
--       target_company_id,
--       actor_user_id,
--       action_type,
--       old_status,
--       new_status,
--       reason,
--       created_at
--     )
--     VALUES (
--       'company',
--       p_target_company_id,
--       p_actor_user_id,
--       p_action_type,
--       lower(trim(v_old_status)),
--       v_new_status,
--       v_reason,
--       now()
--     );
--     -- NOTE: live INSERT omits target_id and target_name
--
--     RETURN QUERY
--     SELECT p_target_company_id, lower(trim(v_old_status)), v_new_status;
--   END;
--   $function$
--
-- ── Line-by-line diff: Live Production vs this migration ───────────────────────
--
-- DIFF A — SELECT statement
--   Live:  SELECT c.status::text INTO v_old_status ...
--   Patch: SELECT c.status       INTO v_old_status ...
--   Risk:  Patch drops the ::text cast from the company_status enum.
--          companies.status is a company_status enum type; the cast is required
--          to safely assign to the text variable v_old_status in all PG versions.
--          MUST be preserved in any rework.
--
-- DIFF B — UPDATE statement
--   Live:  EXECUTE 'UPDATE public.companies SET status = $1::company_status WHERE id = $2'
--   Patch: EXECUTE 'UPDATE public.companies SET status = $1 WHERE id = $2'
--   Risk:  Patch drops the ::company_status cast in the dynamic UPDATE.
--          Without the explicit cast, PostgreSQL must implicitly coerce text → enum,
--          which can fail on strict enum configurations.
--          MUST be preserved in any rework.
--
-- DIFF C — INSERT column list and values
--   Live:  target_type='company' present; target_id absent; target_name absent
--   Patch: target_type='company' present; target_id=p_target_company_id added;
--          target_name=format('Company %s', p_target_company_id) added
--   Question: whether target_id and/or target_name are NOT NULL in owner_audit_log
--             determines whether this is an active bug or a harmless addition.
--             Run the read-only column query below to resolve.
--
-- DIFF D — INSERT column order (cosmetic; no semantic impact)
--   Live:  target_type, target_company_id, actor_user_id, ...
--   Patch: actor_user_id, target_type, target_id, target_name, target_company_id, ...
--
-- ── Required actions before any Production SQL ─────────────────────────────────
--
-- 1. Run this read-only column query and archive output:
--
--      SELECT column_name, data_type, udt_name, is_nullable, column_default
--      FROM information_schema.columns
--      WHERE table_schema = 'public'
--        AND table_name = 'owner_audit_log'
--      ORDER BY ordinal_position;
--
--    If target_id is NOT NULL → the live function is currently broken on target_id;
--      a reworked patch is needed that preserves DIFF A and DIFF B casts.
--    If target_id is nullable → the live function is fully correct; no patch needed.
--
-- 2. If a rework is required, author a new migration that:
--    a. Preserves SELECT c.status::text (DIFF A)
--    b. Preserves UPDATE ... status = $1::company_status (DIFF B)
--    c. Adds only target_id and target_name to the INSERT (DIFF C)
--    d. Does NOT change any other behavior
--
-- 3. Validate the reworked migration on a disposable/staging database loaded with
--    the captured live body above.
--
-- 4. Obtain Platform Owner written approval before applying to Production.
--
-- This migration intentionally patches only set_company_status_governance while
-- preserving its business rules, SECURITY DEFINER posture, search_path, return
-- type, and grants — but the function body below does NOT match the live Production
-- body (see DIFF A and DIFF B above).  Do not apply until reworked.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_type'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_type text NOT NULL must exist before applying 20260801153000_fix_company_governance_audit_target.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_id'
      AND udt_name = 'uuid'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_id uuid must exist before applying 20260801153000_fix_company_governance_audit_target.'
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
      'owner_audit_log.target_name text must exist before applying 20260801153000_fix_company_governance_audit_target.'
      USING ERRCODE = '23514';
  END IF;
END $$;

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
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required for governance status updates.'
      USING ERRCODE = '23502';
  END IF;

  SELECT c.status
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

  EXECUTE 'UPDATE public.companies SET status = $1 WHERE id = $2'
  USING v_new_status, p_target_company_id;

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
    'company',
    p_target_company_id,
    format('Company %s', p_target_company_id),
    p_target_company_id,
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
