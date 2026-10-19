BEGIN;

CREATE OR REPLACE FUNCTION public.super_admin_missing_onboarding_documents(p_application_ids uuid[])
RETURNS TABLE (application_id uuid, document_family text, doc_type text, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT requested.application_id, missing.document_family, missing.doc_type, missing.reason
  FROM unnest(COALESCE(p_application_ids, ARRAY[]::uuid[])) AS requested(application_id)
  CROSS JOIN LATERAL public.get_missing_onboarding_documents(requested.application_id) AS missing;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_audit_action_counts(p_action_types text[])
RETURNS TABLE (action_type text, exact_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT requested.action_type, count(log.id)::bigint
  FROM unnest(COALESCE(p_action_types, ARRAY[]::text[])) AS requested(action_type)
  LEFT JOIN public.owner_audit_log log ON log.action_type = requested.action_type
  GROUP BY requested.action_type;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_latest_job_locations(p_job_ids uuid[])
RETURNS TABLE (job_id uuid, recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT requested.job_id, latest.recorded_at
  FROM unnest(COALESCE(p_job_ids, ARRAY[]::uuid[])) AS requested(job_id)
  CROSS JOIN LATERAL (
    SELECT dl.recorded_at
    FROM public.driver_locations dl
    WHERE dl.job_id = requested.job_id
    ORDER BY dl.recorded_at DESC, dl.id DESC
    LIMIT 1
  ) AS latest;
$$;

REVOKE ALL ON FUNCTION public.super_admin_missing_onboarding_documents(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_missing_onboarding_documents(uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.super_admin_audit_action_counts(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_audit_action_counts(text[]) TO service_role;
REVOKE ALL ON FUNCTION public.super_admin_latest_job_locations(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_latest_job_locations(uuid[]) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
