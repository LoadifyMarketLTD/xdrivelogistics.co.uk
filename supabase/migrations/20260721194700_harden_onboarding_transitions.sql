-- Keep every caller on the same onboarding state machine. Browser clients may
-- not invoke submit directly; the authenticated API validates payload and uses
-- the service role. The trigger prevents an accidental or legacy code path from
-- skipping review or reopening an approved account.

BEGIN;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_onboarding_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old text := lower(trim(COALESCE(OLD.status, '')));
  v_new text := lower(trim(COALESCE(NEW.status, '')));
BEGIN
  IF v_old = v_new THEN
    RETURN NEW;
  END IF;

  IF v_old = '' OR v_new = '' THEN
    RAISE EXCEPTION 'Onboarding status transition requires old and new values.'
      USING ERRCODE = '23514';
  END IF;

  IF v_old = 'invited' AND v_new IN ('draft', 'in_progress') THEN
    RETURN NEW;
  ELSIF v_old = 'draft' AND v_new IN ('in_progress', 'under_review', 'approved') THEN
    RETURN NEW;
  ELSIF v_old = 'in_progress' AND v_new IN ('under_review', 'approved') THEN
    RETURN NEW;
  ELSIF v_old = 'request_changes' AND v_new IN ('in_progress', 'under_review') THEN
    RETURN NEW;
  ELSIF v_old IN ('submitted', 'compliance_review', 'admin_approval', 'pending_approval')
    AND v_new IN ('under_review', 'approved', 'rejected', 'request_changes') THEN
    RETURN NEW;
  ELSIF v_old = 'under_review' AND v_new IN ('approved', 'rejected', 'request_changes') THEN
    RETURN NEW;
  ELSIF v_old = 'rejected' AND v_new = 'request_changes' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid onboarding status transition: % -> %', v_old, v_new
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_onboarding_status_transition ON public.onboarding_applications;
CREATE TRIGGER trg_guard_onboarding_status_transition
BEFORE UPDATE OF status ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.guard_onboarding_status_transition();

-- Keep the user-facing submit notification idempotent even when two HTTP
-- requests arrive together. Preserve the oldest event and remove only duplicate
-- onboarding_submitted rows before installing the partial unique index.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY event_type, entity_type, entity_id
      ORDER BY created_at ASC, id ASC
    ) AS occurrence
  FROM public.notification_events
  WHERE event_type = 'onboarding_submitted'
    AND entity_type = 'onboarding_application'
)
DELETE FROM public.notification_events n
USING ranked r
WHERE n.id = r.id
  AND r.occurrence > 1;

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_one_onboarding_submission_idx
  ON public.notification_events (event_type, entity_type, entity_id)
  WHERE event_type = 'onboarding_submitted'
    AND entity_type = 'onboarding_application';

NOTIFY pgrst, 'reload schema';
COMMIT;
