-- Migration 057: Safe driver deduplication utility
--
-- Problem:
--   The trigger prevent_unsafe_driver_delete() blocks hard-deletes of any
--   driver whose status = 'active' (or IS NULL) with:
--     ERROR 23000: Cannot hard delete an active driver. Deactivate the driver first.
--
--   Any dedup/merge script that tries:
--     DELETE FROM public.drivers WHERE id IS DISTINCT FROM <keep_id>
--   will hit this guard for every active duplicate.
--
-- Solution:
--   A helper function public.safe_dedup_drivers(p_keep_driver_id uuid)
--   that:
--     1. Deactivates all duplicate drivers (same company + email/phone/user_id
--        as the kept driver) by setting status = 'inactive'.
--     2. Verifies none of the duplicates have open jobs (re-uses the same
--        check the trigger performs, but gives a friendlier error).
--     3. Hard-deletes the now-inactive duplicates.
--
--   Call it from your dedup script instead of the raw DELETE:
--     SELECT public.safe_dedup_drivers('<uuid-of-driver-to-keep>');
--
-- Idempotent: CREATE OR REPLACE / safe to re-run.

BEGIN;

CREATE OR REPLACE FUNCTION public.safe_dedup_drivers(p_keep_driver_id uuid)
RETURNS TABLE (deleted_id uuid, deleted_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id  uuid;
  v_email       text;
  v_phone       text;
  v_user_id     uuid;
  v_dup         record;
BEGIN
  -- ── 1. Resolve the keeper's identity fields ──────────────────────────────
  SELECT company_id, email, phone, user_id
    INTO v_company_id, v_email, v_phone, v_user_id
    FROM public.drivers
   WHERE id = p_keep_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver % not found', p_keep_driver_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── 2. Iterate over duplicates (same company + matching identity) ─────────
  FOR v_dup IN
    SELECT d.id, d.first_name, d.last_name, d.status
      FROM public.drivers d
     WHERE d.id <> p_keep_driver_id
       AND d.company_id = v_company_id
       AND (
             (v_email   IS NOT NULL AND d.email   = v_email)
          OR (v_phone   IS NOT NULL AND d.phone   = v_phone)
          OR (v_user_id IS NOT NULL AND d.user_id = v_user_id)
       )
  LOOP
    -- ── 2a. Check for open jobs before touching status ───────────────────
    IF EXISTS (
      SELECT 1
        FROM public.jobs j
       WHERE (j.assigned_driver_id = v_dup.id OR j.driver_id = v_dup.id)
         AND (
               j.status IS NULL
            OR j.status::text NOT IN ('delivered', 'cancelled', 'disputed')
         )
    ) THEN
      RAISE EXCEPTION
        'Duplicate driver % (% %) has open jobs and cannot be removed. Reassign jobs first.',
        v_dup.id,
        v_dup.first_name,
        v_dup.last_name
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- ── 2b. Deactivate so the trigger allows deletion ────────────────────
    UPDATE public.drivers
       SET status = 'inactive'
     WHERE id = v_dup.id
       AND COALESCE(status, 'active') = 'active';   -- only touch if still active

    -- ── 2c. Delete and return info about what was removed ────────────────
    DELETE FROM public.drivers WHERE id = v_dup.id;

    deleted_id   := v_dup.id;
    deleted_name := COALESCE(v_dup.first_name || ' ' || v_dup.last_name, v_dup.id::text);
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.safe_dedup_drivers(uuid) IS
  'Safely removes duplicate drivers that share company_id + email/phone/user_id '
  'with p_keep_driver_id. Deactivates each duplicate first (satisfying the '
  'prevent_unsafe_driver_delete trigger), then hard-deletes it. '
  'Raises an error if any duplicate has open/active jobs.';

GRANT EXECUTE ON FUNCTION public.safe_dedup_drivers(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
