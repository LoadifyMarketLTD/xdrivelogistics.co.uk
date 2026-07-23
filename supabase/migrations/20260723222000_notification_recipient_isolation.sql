-- P0 notification read isolation.
--
-- Private events are visible only to the exact recipient. Rows without a
-- recipient are company broadcasts and require the canonical active-company
-- membership check. Provider processing remains service-role only.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('public.notification_events') IS NULL THEN
    RAISE EXCEPTION 'notification_events table is required before recipient isolation can be installed.';
  END IF;

  IF to_regprocedure('public.is_company_member(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Canonical public.is_company_member(uuid) helper is required before notification isolation can be installed.';
  END IF;
END;
$$;

DROP POLICY IF EXISTS notification_events_select_company
  ON public.notification_events;
DROP POLICY IF EXISTS notification_events_select_recipient_or_company_broadcast
  ON public.notification_events;

-- Remove the superseded branch-only helper if an earlier preview applied it.
DROP FUNCTION IF EXISTS public.notification_has_active_company_membership(uuid);

REVOKE SELECT ON TABLE public.notification_events FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.notification_events TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;

CREATE POLICY notification_events_select_recipient_or_company_broadcast
  ON public.notification_events
  FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR (
      recipient_user_id IS NULL
      AND company_id IS NOT NULL
      AND public.is_company_member(company_id)
    )
  );

COMMENT ON POLICY notification_events_select_recipient_or_company_broadcast
  ON public.notification_events
IS 'Private rows are recipient-only; company broadcasts require active membership in an active company.';

NOTIFY pgrst, 'reload schema';

COMMIT;
