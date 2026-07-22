-- Phase 1 security containment: notification recipient isolation.
--
-- Replaces the legacy company-wide SELECT policy from migration 071.
-- Private notification rows are visible only to their intended recipient.
-- Company broadcasts remain visible to users with an active membership in the
-- notification row's company. This migration intentionally changes no producer
-- semantics and does not modify unrelated policies.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- A narrowly scoped resource-based helper avoids profiles.company_id and avoids
-- recursion through company_memberships RLS while checking only the membership
-- condition required for notification broadcasts.
CREATE OR REPLACE FUNCTION public.notification_has_active_company_membership(
  p_company_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      WHERE cm.company_id = p_company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.notification_has_active_company_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notification_has_active_company_membership(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.notification_has_active_company_membership(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS notification_events_select_company
  ON public.notification_events;
DROP POLICY IF EXISTS notification_events_select_recipient_or_company_broadcast
  ON public.notification_events;

CREATE POLICY notification_events_select_recipient_or_company_broadcast
  ON public.notification_events
  FOR SELECT
  TO authenticated
  USING (
    (
      recipient_user_id IS NOT NULL
      AND recipient_user_id = auth.uid()
    )
    OR
    (
      recipient_user_id IS NULL
      AND public.notification_has_active_company_membership(company_id)
    )
  );

COMMENT ON POLICY notification_events_select_recipient_or_company_broadcast
  ON public.notification_events
IS 'Private rows are recipient-only; company broadcasts require active membership in the row company.';

NOTIFY pgrst, 'reload schema';

COMMIT;
