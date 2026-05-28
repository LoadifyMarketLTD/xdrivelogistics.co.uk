-- Allow creator of a newly inserted company to attach the initial owner membership.
-- This closes the create-company orphan flow from the client app.

CREATE OR REPLACE FUNCTION public.is_company_creator(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = cid
      AND c.created_by = auth.uid()
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_memberships'
      AND policyname = 'memberships_insert_creator'
  ) THEN
    CREATE POLICY "memberships_insert_creator"
      ON public.company_memberships
      FOR INSERT
      WITH CHECK (public.is_company_creator(company_id));
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
