BEGIN;

CREATE TABLE IF NOT EXISTS public.company_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_departments_company_name_unique
  ON public.company_departments(company_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS company_departments_company_idx
  ON public.company_departments(company_id, name);

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.company_departments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS company_memberships_department_idx
  ON public.company_memberships(department_id)
  WHERE department_id IS NOT NULL;

ALTER TABLE public.company_departments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_departments TO authenticated;

DROP POLICY IF EXISTS company_departments_select_member ON public.company_departments;
CREATE POLICY company_departments_select_member ON public.company_departments
  FOR SELECT TO authenticated
  USING (public.is_company_non_driver(company_id));

DROP POLICY IF EXISTS company_departments_insert_admin ON public.company_departments;
CREATE POLICY company_departments_insert_admin ON public.company_departments
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_company_admin(company_id));

DROP POLICY IF EXISTS company_departments_update_admin ON public.company_departments;
CREATE POLICY company_departments_update_admin ON public.company_departments
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS company_departments_delete_admin ON public.company_departments;
CREATE POLICY company_departments_delete_admin ON public.company_departments
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

CREATE OR REPLACE FUNCTION public.enforce_membership_department_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.company_departments d
    WHERE d.id = NEW.department_id
      AND d.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Department is outside this company workspace.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS company_memberships_department_company_guard ON public.company_memberships;
CREATE TRIGGER company_memberships_department_company_guard
  BEFORE INSERT OR UPDATE OF department_id, company_id ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_membership_department_company();

REVOKE ALL ON FUNCTION public.enforce_membership_department_company() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_membership_department_company() TO service_role;

COMMENT ON TABLE public.company_departments IS
  'Company-scoped organisational departments used for team ownership and workflow grouping.';
COMMENT ON COLUMN public.company_memberships.department_id IS
  'Optional company department assignment. Database trigger prevents cross-company assignment.';

COMMIT;
