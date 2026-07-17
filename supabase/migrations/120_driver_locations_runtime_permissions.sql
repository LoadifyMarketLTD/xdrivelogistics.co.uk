-- Runtime permissions for driver_locations.
--
-- Operations Centre and fleet views read driver location rows through the
-- authenticated user's JWT. Earlier schema repair migrations created RLS
-- policies, but production can still fail with "permission denied for table
-- driver_locations" when table privileges were never granted to authenticated.

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_locations TO service_role;

DROP POLICY IF EXISTS driver_locations_all_member ON public.driver_locations;
DROP POLICY IF EXISTS driver_locations_select_member_or_self ON public.driver_locations;
DROP POLICY IF EXISTS driver_locations_insert_self_or_admin ON public.driver_locations;
DROP POLICY IF EXISTS driver_locations_update_self_or_admin ON public.driver_locations;
DROP POLICY IF EXISTS driver_locations_delete_admin ON public.driver_locations;

CREATE POLICY driver_locations_select_member_or_self
  ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND (
          d.user_id = auth.uid()
          OR public.is_company_member(d.company_id)
        )
    )
  );

CREATE POLICY driver_locations_insert_self
  ON public.driver_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY driver_locations_update_self
  ON public.driver_locations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND d.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
