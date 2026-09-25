BEGIN;

CREATE TABLE IF NOT EXISTS public.company_department_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  department_id uuid,
  membership_id uuid,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('department_created','department_updated','department_deleted','member_department_changed')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_department_audit_company_created_idx
  ON public.company_department_audit(company_id, created_at DESC);

ALTER TABLE public.company_department_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.company_department_audit TO authenticated;
GRANT ALL ON public.company_department_audit TO service_role;

DROP POLICY IF EXISTS company_department_audit_select_member ON public.company_department_audit;
CREATE POLICY company_department_audit_select_member ON public.company_department_audit
  FOR SELECT TO authenticated
  USING (public.is_company_non_driver(company_id));

CREATE OR REPLACE FUNCTION public.manage_company_department(
  p_company_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_department_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS public.company_departments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row public.company_departments%ROWTYPE;
  v_old public.company_departments%ROWTYPE;
BEGIN
  SELECT public.active_company_membership_role(p_company_id, p_actor_user_id) INTO v_role;
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Company owner or admin access is required.' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'create' THEN
    INSERT INTO public.company_departments(company_id,name,description,created_by)
    VALUES (p_company_id,btrim(p_name),NULLIF(btrim(p_description),''),p_actor_user_id)
    RETURNING * INTO v_row;
    INSERT INTO public.company_department_audit(company_id,department_id,actor_user_id,action,detail)
    VALUES (p_company_id,v_row.id,p_actor_user_id,'department_created',jsonb_build_object('name',v_row.name,'description',v_row.description));
    RETURN v_row;
  END IF;

  SELECT * INTO v_old
  FROM public.company_departments
  WHERE id = p_department_id AND company_id = p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department not found.' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'update' THEN
    UPDATE public.company_departments
    SET name = COALESCE(NULLIF(btrim(p_name),''), name),
        description = CASE WHEN p_description IS NULL THEN description ELSE NULLIF(btrim(p_description),'') END,
        updated_at = now()
    WHERE id = p_department_id AND company_id = p_company_id
    RETURNING * INTO v_row;
    INSERT INTO public.company_department_audit(company_id,department_id,actor_user_id,action,detail)
    VALUES (p_company_id,v_row.id,p_actor_user_id,'department_updated',jsonb_build_object(
      'old_name',v_old.name,'new_name',v_row.name,'old_description',v_old.description,'new_description',v_row.description));
    RETURN v_row;
  END IF;

  IF p_action = 'delete' THEN
    IF EXISTS (SELECT 1 FROM public.company_memberships WHERE company_id=p_company_id AND department_id=p_department_id) THEN
      RAISE EXCEPTION 'Move members out of this department before deleting it.' USING ERRCODE = '23514';
    END IF;
    DELETE FROM public.company_departments WHERE id=p_department_id AND company_id=p_company_id;
    INSERT INTO public.company_department_audit(company_id,department_id,actor_user_id,action,detail)
    VALUES (p_company_id,p_department_id,p_actor_user_id,'department_deleted',jsonb_build_object('name',v_old.name,'description',v_old.description));
    RETURN v_old;
  END IF;

  RAISE EXCEPTION 'Unsupported department action.' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_company_membership_department(
  p_company_id uuid,
  p_actor_user_id uuid,
  p_membership_id uuid,
  p_department_id uuid DEFAULT NULL
)
RETURNS public.company_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row public.company_memberships%ROWTYPE;
  v_old_department uuid;
BEGIN
  SELECT public.active_company_membership_role(p_company_id, p_actor_user_id) INTO v_role;
  IF v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Company owner or admin access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT department_id INTO v_old_department
  FROM public.company_memberships
  WHERE id=p_membership_id AND company_id=p_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found.' USING ERRCODE = 'P0002'; END IF;

  IF p_department_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.company_departments WHERE id=p_department_id AND company_id=p_company_id
  ) THEN
    RAISE EXCEPTION 'Department is outside this company workspace.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.company_memberships
  SET department_id=p_department_id
  WHERE id=p_membership_id AND company_id=p_company_id
  RETURNING * INTO v_row;

  INSERT INTO public.company_department_audit(company_id,department_id,membership_id,actor_user_id,action,detail)
  VALUES (p_company_id,p_department_id,p_membership_id,p_actor_user_id,'member_department_changed',jsonb_build_object(
    'old_department_id',v_old_department,'new_department_id',p_department_id));
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.manage_company_department(uuid,uuid,text,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_company_membership_department(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_company_department(uuid,uuid,text,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_company_membership_department(uuid,uuid,uuid,uuid) TO service_role;

COMMENT ON TABLE public.company_department_audit IS
  'Append-only company-scoped audit history for department lifecycle and membership assignment.';

COMMIT;
