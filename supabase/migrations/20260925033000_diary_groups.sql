BEGIN;

CREATE TABLE IF NOT EXISTS public.diary_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS diary_groups_company_name_unique
  ON public.diary_groups(company_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS diary_groups_company_idx
  ON public.diary_groups(company_id, name);

CREATE TABLE IF NOT EXISTS public.diary_group_jobs (
  group_id uuid NOT NULL REFERENCES public.diary_groups(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, job_id)
);

CREATE INDEX IF NOT EXISTS diary_group_jobs_company_job_idx
  ON public.diary_group_jobs(company_id, job_id);

CREATE OR REPLACE FUNCTION public.enforce_diary_group_job_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT g.company_id INTO v_company_id
  FROM public.diary_groups g
  WHERE g.id = NEW.group_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Diary group not found.' USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = NEW.job_id
      AND (
        j.company_id = v_company_id
        OR j.awarded_carrier_company_id = v_company_id
        OR j.assigned_company_id = v_company_id
      )
  ) THEN
    RAISE EXCEPTION 'Booking is outside this company workspace.' USING ERRCODE = '42501';
  END IF;

  NEW.company_id := v_company_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS diary_group_jobs_company_guard ON public.diary_group_jobs;
CREATE TRIGGER diary_group_jobs_company_guard
  BEFORE INSERT OR UPDATE ON public.diary_group_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_diary_group_job_company();

ALTER TABLE public.diary_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_group_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diary_groups, public.diary_group_jobs TO authenticated;

DROP POLICY IF EXISTS diary_groups_select_company ON public.diary_groups;
CREATE POLICY diary_groups_select_company ON public.diary_groups
  FOR SELECT TO authenticated
  USING (public.is_company_non_driver(company_id));

DROP POLICY IF EXISTS diary_groups_insert_operator ON public.diary_groups;
CREATE POLICY diary_groups_insert_operator ON public.diary_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'dispatcher')
  );

DROP POLICY IF EXISTS diary_groups_update_operator ON public.diary_groups;
CREATE POLICY diary_groups_update_operator ON public.diary_groups
  FOR UPDATE TO authenticated
  USING (public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'dispatcher'))
  WITH CHECK (public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'dispatcher'));

DROP POLICY IF EXISTS diary_groups_delete_operator ON public.diary_groups;
CREATE POLICY diary_groups_delete_operator ON public.diary_groups
  FOR DELETE TO authenticated
  USING (public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'dispatcher'));

DROP POLICY IF EXISTS diary_group_jobs_select_company ON public.diary_group_jobs;
CREATE POLICY diary_group_jobs_select_company ON public.diary_group_jobs
  FOR SELECT TO authenticated
  USING (public.is_company_non_driver(company_id));

DROP POLICY IF EXISTS diary_group_jobs_insert_operator ON public.diary_group_jobs;
CREATE POLICY diary_group_jobs_insert_operator ON public.diary_group_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'dispatcher')
  );

DROP POLICY IF EXISTS diary_group_jobs_delete_operator ON public.diary_group_jobs;
CREATE POLICY diary_group_jobs_delete_operator ON public.diary_group_jobs
  FOR DELETE TO authenticated
  USING (public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'dispatcher'));

REVOKE ALL ON FUNCTION public.enforce_diary_group_job_company() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_diary_group_job_company() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_diary_group_job_company() TO service_role;

CREATE TABLE IF NOT EXISTS public.diary_group_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  group_id uuid,
  job_id uuid,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('group_created','group_renamed','group_deleted','job_added','job_removed')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS diary_group_audit_company_created_idx
  ON public.diary_group_audit(company_id, created_at DESC);
ALTER TABLE public.diary_group_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.diary_group_audit TO authenticated;
GRANT ALL ON public.diary_group_audit TO service_role;
DROP POLICY IF EXISTS diary_group_audit_select_company ON public.diary_group_audit;
CREATE POLICY diary_group_audit_select_company ON public.diary_group_audit
  FOR SELECT TO authenticated USING (public.is_company_non_driver(company_id));

CREATE OR REPLACE FUNCTION public.audit_diary_group_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.diary_group_audit(company_id, group_id, actor_user_id, action, detail)
    VALUES (NEW.company_id, NEW.id, auth.uid(), 'group_created', jsonb_build_object('new_name', NEW.name));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      INSERT INTO public.diary_group_audit(company_id, group_id, actor_user_id, action, detail)
      VALUES (NEW.company_id, NEW.id, auth.uid(), 'group_renamed', jsonb_build_object('old_name', OLD.name, 'new_name', NEW.name));
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO public.diary_group_audit(company_id, group_id, actor_user_id, action, detail)
    VALUES (OLD.company_id, OLD.id, auth.uid(), 'group_deleted', jsonb_build_object('old_name', OLD.name));
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_diary_group_job_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.diary_group_audit(company_id, group_id, job_id, actor_user_id, action)
    VALUES (NEW.company_id, NEW.group_id, NEW.job_id, auth.uid(), 'job_added');
    RETURN NEW;
  ELSE
    INSERT INTO public.diary_group_audit(company_id, group_id, job_id, actor_user_id, action)
    VALUES (OLD.company_id, OLD.group_id, OLD.job_id, auth.uid(), 'job_removed');
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS diary_groups_audit_trigger ON public.diary_groups;
CREATE TRIGGER diary_groups_audit_trigger
  AFTER INSERT OR UPDATE OF name OR DELETE ON public.diary_groups
  FOR EACH ROW EXECUTE FUNCTION public.audit_diary_group_change();
DROP TRIGGER IF EXISTS diary_group_jobs_audit_trigger ON public.diary_group_jobs;
CREATE TRIGGER diary_group_jobs_audit_trigger
  AFTER INSERT OR DELETE ON public.diary_group_jobs
  FOR EACH ROW EXECUTE FUNCTION public.audit_diary_group_job_change();

REVOKE ALL ON FUNCTION public.audit_diary_group_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_diary_group_job_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_diary_group_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_diary_group_job_change() TO service_role;

COMMENT ON TABLE public.diary_groups IS
  'Company-scoped operational Diary groups.';
COMMENT ON TABLE public.diary_group_jobs IS
  'Company-scoped many-to-many booking membership for Diary groups.';
COMMENT ON TABLE public.diary_group_audit IS
  'Append-only company-scoped audit trail for Diary group lifecycle and booking membership.';

COMMIT;
