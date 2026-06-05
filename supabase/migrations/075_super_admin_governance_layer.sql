-- ============================================================
-- Migration 075 — Super-Admin Governance Layer
-- ============================================================
-- STATUS: PROPOSED — do NOT apply until owner approves.
-- ============================================================

BEGIN;

-- ── 1. Canonical company status values (legacy inactive kept) ───────────────
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_status_canonical;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_status_canonical
  CHECK (status IN ('active', 'inactive', 'pending_approval', 'rejected', 'suspended'));

-- ── 2. Owner-level RLS policy for cross-company SELECT/UPDATE ───────────────
DROP POLICY IF EXISTS companies_select_owner_all ON public.companies;
CREATE POLICY companies_select_owner_all ON public.companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS companies_update_owner ON public.companies;
CREATE POLICY companies_update_owner ON public.companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- ── 3. Governance audit table (required schema) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_audit_log (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id     uuid         NOT NULL,
  target_company_id uuid         NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action_type       text         NOT NULL,
  old_status        text         NOT NULL,
  new_status        text         NOT NULL,
  reason            text         NOT NULL,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_audit_log_owner_select ON public.owner_audit_log;
CREATE POLICY owner_audit_log_owner_select ON public.owner_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND role = 'owner'
    )
  );

REVOKE ALL ON public.owner_audit_log FROM PUBLIC;
GRANT SELECT ON public.owner_audit_log TO authenticated;

-- ── 4. Transition guard helper (exact allowed transitions) ──────────────────
CREATE OR REPLACE FUNCTION public.assert_company_status_transition(
  p_old_status text,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text := lower(trim(COALESCE(p_old_status, '')));
  v_new_status text := lower(trim(COALESCE(p_new_status, '')));
BEGIN
  IF v_old_status = '' OR v_new_status = '' THEN
    RAISE EXCEPTION 'Status transition requires both old and new status values.'
      USING ERRCODE = '23514';
  END IF;

  IF v_old_status = 'pending_approval' AND v_new_status IN ('active', 'rejected') THEN
    RETURN;
  ELSIF v_old_status = 'active' AND v_new_status = 'suspended' THEN
    RETURN;
  ELSIF v_old_status = 'suspended' AND v_new_status = 'active' THEN
    RETURN;
  ELSIF v_old_status = 'rejected' AND v_new_status = 'pending_approval' THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Invalid company status transition: % -> %', v_old_status, v_new_status
    USING ERRCODE = '23514';
END;
$$;

-- ── 5. Safe mutation function (audit + update in one transaction) ───────────
CREATE OR REPLACE FUNCTION public.set_company_status_governance(
  p_actor_user_id uuid,
  p_target_company_id uuid,
  p_action_type text,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  company_id uuid,
  old_status text,
  new_status text
)
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

  UPDATE public.companies
  SET status = v_new_status
  WHERE id = p_target_company_id;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    created_at
  )
  VALUES (
    p_actor_user_id,
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

-- ── 6. DB-level protection against direct companies.status updates ───────────
CREATE OR REPLACE FUNCTION public.guard_company_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_context text := COALESCE(current_setting('app.company_status_change_context', true), '');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.assert_company_status_transition(OLD.status, NEW.status);

    IF v_context <> 'governance_api' THEN
      RAISE EXCEPTION 'Direct companies.status updates are blocked. Use set_company_status_governance().'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_company_status_update ON public.companies;
CREATE TRIGGER trg_guard_company_status_update
BEFORE UPDATE OF status ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.guard_company_status_update();

-- ── 7. Enforce operational access only for active companies ─────────────────
CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND c.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND cm.role_in_company IN ('owner', 'admin')
      AND c.status = 'active'
  );
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
