BEGIN;

CREATE OR REPLACE FUNCTION public.super_admin_latest_driver_locations(p_driver_ids uuid[])
RETURNS TABLE (
  id uuid, driver_id uuid, job_id uuid, vehicle_id uuid, recorded_at timestamptz,
  location text, lat double precision, lng double precision, heading double precision,
  speed_mph double precision, source text, source_provider text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT latest.id, latest.driver_id, latest.job_id, latest.vehicle_id, latest.recorded_at,
         latest.location::text, latest.lat, latest.lng, latest.heading, latest.speed_mph,
         latest.source, latest.source_provider
  FROM unnest(COALESCE(p_driver_ids, ARRAY[]::uuid[])) AS requested(driver_id)
  CROSS JOIN LATERAL (
    SELECT dl.*
    FROM public.driver_locations dl
    WHERE dl.driver_id = requested.driver_id
    ORDER BY dl.recorded_at DESC, dl.id DESC
    LIMIT 1
  ) AS latest;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_latest_job_driver_locations(p_pairs jsonb)
RETURNS TABLE (
  id uuid, driver_id uuid, job_id uuid, vehicle_id uuid, recorded_at timestamptz,
  location text, lat double precision, lng double precision, heading double precision,
  speed_mph double precision, source text, source_provider text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT latest.id, latest.driver_id, latest.job_id, latest.vehicle_id, latest.recorded_at,
         latest.location::text, latest.lat, latest.lng, latest.heading, latest.speed_mph,
         latest.source, latest.source_provider
  FROM jsonb_to_recordset(COALESCE(p_pairs, '[]'::jsonb))
    AS requested(job_id uuid, driver_id uuid)
  CROSS JOIN LATERAL (
    SELECT dl.*
    FROM public.driver_locations dl
    WHERE dl.job_id = requested.job_id
      AND dl.driver_id = requested.driver_id
    ORDER BY dl.recorded_at DESC, dl.id DESC
    LIMIT 1
  ) AS latest;
$$;

REVOKE ALL ON FUNCTION public.super_admin_latest_driver_locations(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_latest_driver_locations(uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.super_admin_latest_job_driver_locations(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_latest_job_driver_locations(jsonb) TO service_role;

COMMENT ON FUNCTION public.super_admin_latest_driver_locations(uuid[]) IS
  'Service-role-only batched latest-location lookup for Super Admin driver/fleet views.';

COMMENT ON FUNCTION public.super_admin_latest_job_driver_locations(jsonb) IS
  'Service-role-only batched latest-location lookup for Super Admin tracking views.';

COMMIT;

NOTIFY pgrst, 'reload schema';
