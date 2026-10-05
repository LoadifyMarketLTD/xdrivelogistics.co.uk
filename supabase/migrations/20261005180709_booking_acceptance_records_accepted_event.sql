BEGIN;

ALTER TABLE public.job_tracking_events
  DROP CONSTRAINT IF EXISTS job_tracking_events_event_type_check;

ALTER TABLE public.job_tracking_events
  ADD CONSTRAINT job_tracking_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'created','awarded','allocated','accepted','driver_en_route','on_my_way_to_pickup',
    'arrived_pickup','on_site_pickup','collected','loaded','in_transit','on_my_way_to_delivery',
    'arrived_delivery','on_site_delivery','delivered','completed','failed','cancelled','note',
    'booking_offer_created','booking_offer_declined','payment_obligation_acknowledged',
    'commercial_amendment_proposed','commercial_amendment_accepted','commercial_amendment_rejected',
    'commercial_amendment_cancelled','execution_extra_approved','execution_extra_rejected',
    'driver_instruction_added','multi_drop_stop_arrived','multi_drop_stop_completed','collection_handover'
  ]));

DO $$
DECLARE
  v_def text;
  v_original text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='accept_job_booking_offer_atomic'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'accept_job_booking_offer_atomic not found';
  END IF;

  v_original := v_def;
  v_def := replace(
    v_def,
    $old$||CASE WHEN v_offer.bidder_driver_id IS NOT NULL THEN jsonb_build_array(jsonb_build_object('status','allocated','timestamp',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'auto_assigned_driver_id',v_offer.bidder_driver_id,'auto_assigned_vehicle_id',v_vehicle_id)) ELSE '[]'::jsonb END,$old$,
    $new$||CASE WHEN v_offer.bidder_driver_id IS NOT NULL THEN jsonb_build_array(jsonb_build_object('status','allocated','timestamp',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'auto_assigned_driver_id',v_offer.bidder_driver_id,'auto_assigned_vehicle_id',v_vehicle_id)) ELSE '[]'::jsonb END
      ||CASE WHEN v_offer.bidder_driver_id IS NOT NULL THEN jsonb_build_array(jsonb_build_object('status','accepted','timestamp',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'driver_accepted_by',v_actor,'booking_offer_id',v_offer.id)) ELSE '[]'::jsonb END,$new$
  );

  IF v_def = v_original OR position("'status','accepted'" in v_def)=0 THEN
    RAISE EXCEPTION 'accepted status_history patch failed';
  END IF;

  v_original := v_def;
  v_def := replace(
    v_def,
    $old$IF v_offer.bidder_driver_id IS NOT NULL THEN INSERT INTO public.job_tracking_events(job_id,event_type,created_by,message,meta) VALUES(v_job.id,'allocated',v_actor,'Named bidder driver allocated after carrier acceptance.',jsonb_build_object('assigned_driver_id',v_offer.bidder_driver_id,'vehicle_id',v_vehicle_id)); END IF;$old$,
    $new$IF v_offer.bidder_driver_id IS NOT NULL THEN
    INSERT INTO public.job_tracking_events(job_id,event_type,created_by,message,meta) VALUES(v_job.id,'allocated',v_actor,'Named bidder driver allocated after carrier acceptance.',jsonb_build_object('assigned_driver_id',v_offer.bidder_driver_id,'vehicle_id',v_vehicle_id));
    INSERT INTO public.job_tracking_events(job_id,event_type,created_by,message,meta) VALUES(v_job.id,'accepted',v_actor,'Named bidder driver accepted the booking during carrier acceptance.',jsonb_build_object('assigned_driver_id',v_offer.bidder_driver_id,'vehicle_id',v_vehicle_id,'booking_offer_id',v_offer.id));
  END IF;$new$
  );

  IF v_def = v_original OR position("'accepted',v_actor,'Named bidder driver accepted" in v_def)=0 THEN
    RAISE EXCEPTION 'accepted tracking-event patch failed';
  END IF;

  EXECUTE v_def;
END
$$;

REVOKE ALL ON FUNCTION public.accept_job_booking_offer_atomic(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_booking_offer_atomic(uuid,uuid) TO service_role;

WITH accepted_offers AS (
  SELECT DISTINCT ON (job_id)
    job_id, id AS booking_offer_id, bidder_driver_id, responded_by, responded_at
  FROM public.job_booking_offers
  WHERE status='accepted' AND bidder_driver_id IS NOT NULL
  ORDER BY job_id, responded_at DESC NULLS LAST, id
)
UPDATE public.jobs j
SET status_history = COALESCE(j.status_history,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'status','accepted',
  'timestamp',to_char(COALESCE(o.responded_at,j.updated_at,now()) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'driver_accepted_by',o.responded_by,
  'booking_offer_id',o.booking_offer_id,
  'reconciled',true
))
FROM accepted_offers o
WHERE j.id=o.job_id
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(j.status_history,'[]'::jsonb)) e
    WHERE e->>'status'='accepted'
  );

INSERT INTO public.job_tracking_events(job_id,event_type,created_by,message,meta,created_at)
SELECT
  j.id,
  'accepted',
  o.responded_by,
  'Named bidder driver acceptance reconciled from accepted booking offer.',
  jsonb_build_object('assigned_driver_id',o.bidder_driver_id,'booking_offer_id',o.booking_offer_id,'reconciled',true),
  COALESCE(o.responded_at,j.updated_at,now())
FROM public.jobs j
JOIN LATERAL (
  SELECT id AS booking_offer_id,bidder_driver_id,responded_by,responded_at
  FROM public.job_booking_offers
  WHERE job_id=j.id AND status='accepted' AND bidder_driver_id IS NOT NULL
  ORDER BY responded_at DESC NULLS LAST,id
  LIMIT 1
) o ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_tracking_events e
  WHERE e.job_id=j.id AND e.event_type='accepted'
);

COMMIT;

NOTIFY pgrst, 'reload schema';
