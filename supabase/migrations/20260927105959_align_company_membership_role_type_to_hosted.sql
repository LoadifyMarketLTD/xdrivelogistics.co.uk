BEGIN;

-- Hosted XDrive stores company_memberships.role_in_company as text. Fresh
-- databases still inherit the legacy public.company_role enum from the baseline
-- schema, which prevents the following Fleet Manager foundation migration from
-- installing its text-based role constraint.
ALTER TABLE public.company_memberships
  DROP CONSTRAINT IF EXISTS company_memberships_role_in_company_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.company_memberships
    WHERE role_in_company IS NULL
  ) THEN
    RAISE EXCEPTION 'company_memberships.role_in_company contains NULL rows; manual remediation required before hosted type alignment.';
  END IF;
END;
$$;

ALTER TABLE public.company_memberships
  ALTER COLUMN role_in_company DROP DEFAULT;

ALTER TABLE public.company_memberships
  ALTER COLUMN role_in_company TYPE text
  USING role_in_company::text;

ALTER TABLE public.company_memberships
  ALTER COLUMN role_in_company SET DEFAULT 'member'::text;

ALTER TABLE public.company_memberships
  ALTER COLUMN role_in_company SET NOT NULL;

COMMIT;