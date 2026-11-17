BEGIN;
-- Fail-closed, transactionally serialised driver stop cancellation.
CREATE OR REPLACE FUNCTION public.apply_driver_stop_cancellation_atomic(
  p_job_id uuid, p_stop_id uuid, p_actor_user_id uuid,
  p_expected_status text, p_cancellation jsonb, p_destination text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_stop public.job_stops%ROWTYPE;
  v_follow public.job_stops%ROWTYPE;
  v_sequence integer;
  v_disposition text := COALESCE(p_cancellation->>'goodsDisposition', 'none');
  v_custody boolean := COALESCE((p_cancellation->>'goodsInCustody')::boolean, false);
  v_now timestamptz := now();
  v_handover jsonb;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.drivers d WHERE d.id = v_job.assigned_driver_id
      AND d.user_id = p_actor_user_id AND d.status = 'active'
  ) THEN RAISE EXCEPTION 'Assigned active driver required' USING ERRCODE = '42501'; END IF;
  IF v_job.status::text IN ('completed','invoiced','paid','cancelled')
    OR v_job.current_status::text IN ('completed','invoiced','cancelled') THEN
    RAISE EXCEPTION 'Booking is closed' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_stop FROM public.job_stops WHERE job_id = p_job_id AND id = p_stop_id FOR UPDATE;
  IF NOT FOUND OR v_stop.status <> p_expected_status OR v_stop.status NOT IN ('pending','en_route','arrived') THEN
    RAISE EXCEPTION 'Stop state changed' USING ERRCODE = '23514'; END IF;
  IF COALESCE((v_stop.handover->'returnInstruction'->>'resolutionRequired')::boolean,false) THEN
    RAISE EXCEPTION 'Goods custody requires authorised resolution' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.job_stops s WHERE s.job_id = p_job_id AND s.sequence < v_stop.sequence
      AND s.status NOT IN ('completed','cancelled')) THEN
    RAISE EXCEPTION 'Earlier stop remains unresolved' USING ERRCODE = '23514'; END IF;
  IF v_disposition NOT IN ('none','return_to_collection','return_to_sender_depot','await_instructions','redirect_authorised','replacement_stop') THEN
    RAISE EXCEPTION 'Unsupported goods disposition' USING ERRCODE = '23514'; END IF;
  IF v_custody AND v_disposition = 'none' THEN RAISE EXCEPTION 'Goods disposition required' USING ERRCODE = '23514'; END IF;
  IF NOT v_custody AND v_disposition <> 'none' THEN
    RAISE EXCEPTION 'Goods disposition requires custody' USING ERRCODE = '23514'; END IF;
  IF v_custody AND v_disposition <> 'await_instructions' AND NULLIF(trim(COALESCE(p_destination,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Destination required' USING ERRCODE = '23514'; END IF;
  IF v_custody AND v_disposition = 'await_instructions' THEN
    UPDATE public.job_stops SET handover = COALESCE(handover,'{}'::jsonb) || jsonb_build_object(
      'returnInstruction',p_cancellation || jsonb_build_object('reportedAt',v_now,'resolutionRequired',true)), updated_at=v_now
      WHERE id=p_stop_id RETURNING * INTO v_stop;
    RETURN jsonb_build_object('stop',to_jsonb(v_stop),'followUpStop',NULL,'resolutionRequired',true);
  END IF;
  IF v_custody THEN
    SELECT COALESCE(max(sequence),0)+1 INTO v_sequence FROM public.job_stops WHERE job_id=p_job_id;
    INSERT INTO public.job_stops(job_id,sequence,stop_type,address,instructions,status,handover)
      VALUES(p_job_id,v_sequence,'delivery',trim(p_destination),
        CASE WHEN v_disposition LIKE 'return_%' THEN 'Return goods on authorised instruction.' ELSE 'Replacement / redirected delivery authorised.' END,
        'pending',jsonb_build_object('version',3,'stopKind',CASE WHEN v_disposition LIKE 'return_%' THEN 'return' ELSE 'redirect' END,
        'sourceStopId',p_stop_id,'cancellation',p_cancellation,'createdAt',v_now)) RETURNING * INTO v_follow;
  END IF;
  v_handover := jsonb_build_object('version',3,'capturedAt',v_now,'cancellation',
    p_cancellation || jsonb_build_object('followUpStopId',v_follow.id));
  UPDATE public.job_stops SET status='cancelled',cancelled_at=v_now,handover=v_handover,updated_at=v_now
    WHERE id=p_stop_id RETURNING * INTO v_stop;
  RETURN jsonb_build_object('stop',to_jsonb(v_stop),'followUpStop',CASE WHEN v_follow.id IS NULL THEN NULL ELSE to_jsonb(v_follow) END);
END;
$fn$;
REVOKE ALL ON FUNCTION public.apply_driver_stop_cancellation_atomic(uuid,uuid,uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_driver_stop_cancellation_atomic(uuid,uuid,uuid,text,jsonb,text) TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
