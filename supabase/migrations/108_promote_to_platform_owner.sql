-- ============================================================
-- Migration 091 — promote_to_platform_owner helper
-- ============================================================
-- Creates a SECURITY DEFINER function that a super-admin can
-- call to promote any existing user (by email) to the platform
-- 'owner' role:
--   • public.profiles.role  → 'owner'
--   • auth.users.raw_app_meta_data → includes { "role": "owner" }
--
-- Usage (run in Supabase SQL editor as postgres / service role):
--   SELECT promote_to_platform_owner('user@example.com');
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.promote_to_platform_owner(target_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_existing_role text;
BEGIN
  -- ── Resolve user id from email ─────────────────────────────
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(target_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email: %', target_email;
  END IF;

  -- ── Read current profile role ──────────────────────────────
  SELECT role INTO v_existing_role
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_existing_role = 'owner' THEN
    RETURN format('User %s is already owner — no change made.', target_email);
  END IF;

  -- ── Update profiles.role ───────────────────────────────────
  UPDATE public.profiles
  SET role = 'owner', updated_at = now()
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    -- Profile row missing; insert a minimal one
    INSERT INTO public.profiles (user_id, role, status, created_at, updated_at)
    VALUES (v_user_id, 'owner', 'active', now(), now())
    ON CONFLICT (user_id) DO UPDATE
      SET role = 'owner', updated_at = now();
  END IF;

  -- ── Patch auth.users app_metadata ─────────────────────────
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "owner"}'::jsonb
  WHERE id = v_user_id;

  RETURN format('✅ User %s promoted to platform owner (id: %s).', target_email, v_user_id);
END;
$$;

-- Only the service role / postgres can execute this function
REVOKE ALL ON FUNCTION public.promote_to_platform_owner(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_to_platform_owner(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_platform_owner(text) TO service_role;

COMMENT ON FUNCTION public.promote_to_platform_owner(text) IS
  'Promote an existing user (by e-mail) to the platform owner role. '
  'Must be called as postgres or service_role.';

NOTIFY pgrst, 'reload schema';

COMMIT;
