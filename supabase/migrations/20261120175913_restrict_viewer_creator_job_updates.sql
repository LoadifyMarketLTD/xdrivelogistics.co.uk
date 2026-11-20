-- XD-AUD-0007: narrow creator assignment writes; Viewer remains read-only.
-- Preserve every other Jobs policy and the documented legacy member path.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = pg_catalog, public;
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='jobs'
      AND policyname='jobs_update_creator_assign_any_member'
      AND permissive='PERMISSIVE' AND cmd='UPDATE'
      AND roles=ARRAY['authenticated'::name]
      AND qual=$oldqual$((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.company_id = jobs.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (cm.role_in_company = ANY (ARRAY['owner'::text, 'admin'::text, 'dispatcher'::text, 'member'::text, 'viewer'::text])) AND ((c.status)::text = 'active'::text)))))$oldqual$
      AND with_check=$oldcheck$((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.company_id = jobs.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (cm.role_in_company = ANY (ARRAY['owner'::text, 'admin'::text, 'dispatcher'::text, 'member'::text, 'viewer'::text])) AND ((c.status)::text = 'active'::text)))) AND (EXISTS ( SELECT 1
   FROM drivers d
  WHERE ((d.id = jobs.assigned_driver_id) AND (COALESCE(d.app_access, true) = true) AND (COALESCE((d.status)::text, 'active'::text) = 'active'::text)))))$oldcheck$
  ) THEN
    RAISE EXCEPTION 'Creator job policy differs from validated baseline';
  END IF;
END;
$check$;
ALTER POLICY jobs_update_creator_assign_any_member ON public.jobs USING ((((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.company_id = jobs.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (cm.role_in_company = ANY (ARRAY['owner'::text, 'admin'::text, 'dispatcher'::text, 'member'::text])) AND ((c.status)::text = 'active'::text)))))) AND (public.active_company_membership_role(jobs.company_id, auth.uid()) IN ('owner','admin','dispatcher','member'))) WITH CHECK ((((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.company_id = jobs.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::text) AND (cm.role_in_company = ANY (ARRAY['owner'::text, 'admin'::text, 'dispatcher'::text, 'member'::text])) AND ((c.status)::text = 'active'::text)))) AND (EXISTS ( SELECT 1
   FROM drivers d
  WHERE ((d.id = jobs.assigned_driver_id) AND (COALESCE(d.app_access, true) = true) AND (COALESCE((d.status)::text, 'active'::text) = 'active'::text)))))) AND (public.active_company_membership_role(jobs.company_id, auth.uid()) IN ('owner','admin','dispatcher','member')));
COMMIT;
NOTIFY pgrst, 'reload schema';
