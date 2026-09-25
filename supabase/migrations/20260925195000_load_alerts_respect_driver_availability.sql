-- Driver load alerts must respect operational availability.
-- Offline/busy drivers may keep preferences configured, but must not receive new load alerts.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.fn_enqueue_driver_load_alerts_for_job(
  p_job_id uuid,
  p_recipient_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $function$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH target_job AS (
    SELECT j.id,j.company_id,j.status,j.exchange_visibility,j.direct_invite_company_id,j.exchange_posted_at,j.exchange_expires_at,
      j.awarded_carrier_company_id,j.pickup_postcode,j.delivery_postcode,j.pickup_lat,j.pickup_lng,j.pickup_datetime,
      coalesce(j.requested_vehicle_type,j.vehicle_type) AS requested_vehicle_type,j.requested_vehicle_label,j.budget_amount
    FROM public.jobs j
    WHERE j.id=p_job_id AND lower(coalesce(j.status,'')) IN ('posted','quoted')
      AND j.exchange_posted_at IS NOT NULL AND j.awarded_carrier_company_id IS NULL
      AND j.exchange_visibility IN ('exchange','direct')
      AND (j.exchange_expires_at IS NULL OR j.exchange_expires_at>now())
  ),
  candidates AS (
    SELECT p.*,d.company_id AS driver_company_id,d.future_position,d.future_position_date,
      v.vehicle_type AS canonical_vehicle_type,latest.location AS current_location,latest.recorded_at AS current_location_recorded_at,
      tj.id AS job_id,tj.company_id AS job_company_id,tj.exchange_visibility,tj.direct_invite_company_id,tj.pickup_postcode,
      tj.delivery_postcode,tj.pickup_lat,tj.pickup_lng,tj.pickup_datetime,tj.requested_vehicle_type,tj.requested_vehicle_label,tj.budget_amount
    FROM target_job tj
    JOIN public.driver_load_alert_preferences p ON p.enabled=true AND (p_recipient_user_id IS NULL OR p.user_id=p_recipient_user_id)
    JOIN public.drivers d ON d.id=p.driver_id AND d.user_id=p.user_id AND d.company_id=p.company_id
      AND d.app_access=true AND d.status='active' AND d.availability_status='available'
    LEFT JOIN LATERAL (
      SELECT coalesce(vh.vehicle_type,vh.type) AS vehicle_type FROM public.vehicles vh
      WHERE vh.assigned_driver_id=d.id AND vh.company_id=d.company_id AND vh.status='active'
      ORDER BY vh.updated_at DESC NULLS LAST,vh.id LIMIT 1
    ) v ON true
    LEFT JOIN LATERAL (
      SELECT dl.location,dl.recorded_at FROM public.driver_locations dl
      WHERE dl.driver_id=d.id AND dl.location IS NOT NULL ORDER BY dl.recorded_at DESC LIMIT 1
    ) latest ON true
    WHERE d.company_id<>tj.company_id
      AND (tj.exchange_visibility='exchange' OR (tj.exchange_visibility='direct' AND tj.direct_invite_company_id=d.company_id))
      AND (p.minimum_budget_gbp IS NULL OR coalesce(tj.budget_amount,0)>=p.minimum_budget_gbp)
      AND (NOT p.require_vehicle_match OR public.fn_load_alert_vehicle_key(tj.requested_vehicle_type) IS NULL
        OR public.fn_load_alert_vehicle_key(v.vehicle_type)=public.fn_load_alert_vehicle_key(tj.requested_vehicle_type))
  ),
  matched AS (
    SELECT c.*,array_remove(array[
      CASE WHEN c.current_radius_enabled AND c.current_location IS NOT NULL
        AND c.current_location_recorded_at>=now()-make_interval(mins=>c.current_location_max_age_minutes)
        AND c.pickup_lat IS NOT NULL AND c.pickup_lng IS NOT NULL
        AND st_dwithin(c.current_location,st_setsrid(st_makepoint(c.pickup_lng,c.pickup_lat),4326)::geography,c.radius_miles*1609.344)
        THEN 'current_location' END,
      CASE WHEN c.home_outcode_enabled AND public.fn_load_alert_outcode(c.home_outcode) IS NOT NULL
        AND public.fn_load_alert_outcode(c.home_outcode)=public.fn_load_alert_outcode(c.pickup_postcode) THEN 'home_outcode' END,
      CASE WHEN c.future_position_enabled AND c.future_position_date IS NOT NULL
        AND c.future_position_date>=now()-interval '6 hours' AND c.pickup_datetime IS NOT NULL
        AND abs(extract(epoch from (c.future_position_date-c.pickup_datetime)))<=172800
        AND public.fn_load_alert_outcode(c.future_position) IS NOT NULL
        AND public.fn_load_alert_outcode(c.future_position)=public.fn_load_alert_outcode(c.pickup_postcode) THEN 'future_position' END
    ],NULL) AS match_reasons FROM candidates c
  ),
  inserted AS (
    INSERT INTO public.notification_events(event_type,entity_type,entity_id,company_id,recipient_user_id,payload)
    SELECT 'load_alert','job',m.job_id,m.driver_company_id,m.user_id,
      jsonb_build_object('job_id',m.job_id,'pickup_outcode',public.fn_load_alert_outcode(m.pickup_postcode),
        'delivery_outcode',public.fn_load_alert_outcode(m.delivery_postcode),'pickup_datetime',m.pickup_datetime,
        'vehicle_type',coalesce(m.requested_vehicle_label,m.requested_vehicle_type),'budget_amount',m.budget_amount,
        'match_reasons',to_jsonb(m.match_reasons),'in_app_enabled',m.in_app_enabled,'email_enabled',m.email_enabled,'push_enabled',m.push_enabled)
    FROM matched m WHERE cardinality(m.match_reasons)>0 ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;
  RETURN v_inserted;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_enqueue_driver_load_alerts_for_job(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_enqueue_driver_load_alerts_for_job(uuid,uuid) TO service_role;

COMMIT;
