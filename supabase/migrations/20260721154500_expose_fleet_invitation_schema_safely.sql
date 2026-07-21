BEGIN;

ALTER TABLE public.fleet_driver_invitations ENABLE ROW LEVEL SECURITY;

-- PostgREST only caches exposed relations. Granting table verbs makes the
-- relation discoverable, while the absence of authenticated RLS policies keeps
-- every direct user read/write denied. Server routes use service_role, which
-- remains the only effective data-access path.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.fleet_driver_invitations
  TO authenticated;

REVOKE ALL
  ON TABLE public.fleet_driver_invitations
  FROM anon;

DROP POLICY IF EXISTS fleet_driver_invitations_deny_authenticated
  ON public.fleet_driver_invitations;

CREATE POLICY fleet_driver_invitations_deny_authenticated
  ON public.fleet_driver_invitations
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
