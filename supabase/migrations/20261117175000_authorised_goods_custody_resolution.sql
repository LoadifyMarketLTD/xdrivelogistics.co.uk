BEGIN;
-- Only an active owner/admin/dispatcher for the assigned carrier may issue
-- a custody disposition. Serialise on the parent job to prevent duplicate stops.
CREATE OR REPLACE FUNCTION public.resolve_driver_goods_custody_atomic(
  p_job_id uuid, p_stop_id uuid, p_actor_user_id uuid,
  p_disposition text, p_destination text, p_instruction text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_stop public.job_stops%ROWTYPE;
  v_follow public.job_stops%ROWTYPE;
  v_seq integer;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_memberships cm
    WHERE cm.user_id=p_actor_user_id AND cm.status='active'
      AND cm.role_in_company::text IN ('owner','admin','dispatcher')
      AND cm.company_id = v_job.assigned_company_id) THEN
    RAISE EXCEPTION 'Authorised company dispatcher required' USING ERRCODE='42501';
  END IF;
  IF v_job.status::text IN ('completed','invoiced','paid','cancelled') OR
    v_job.current_status::text IN ('completed','invoiced','cancelled') THEN
    RAISE EXCEPTION 'Booking closed' USING ERRCODE='23514'; END IF;
  SELECT * INTO v_stop FROM public.job_stops WHERE job_id=p_job_id AND id=p_stop_id FOR UPDATE;
  IF NOT FOUND OR v_stop.status NOT IN ('pending','en_route','arrived') OR
    NOT COALESCE((v_stop.handover->'returnInstruction'->>'resolutionRequired')::boolean,false) THEN
    RAISE EXCEPTION 'No unresolved custody instruction on this stop' USING ERRCODE='23514'; END IF;
  IF p_disposition NOT IN ('return_to_collection','return_to_sender_depot','redirect_authorised','replacement_stop')
    OR NULLIF(trim(COALESCE(p_destination,'')),'') IS NULL
    OR length(trim(COALESCE(p_instruction,''))) < 5 THEN
    RAISE EXCEPTION 'Valid disposition, destination and instruction required' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(max(sequence),0)+1 INTO v_seq FROM public.job_stops WHERE job_id=p_job_id;
  INSERT INTO public.job_stops(job_id,sequence,stop_type,address,instructions,status,handover)
  VALUES(p_job_id,v_seq,'delivery',trim(p_destination),trim(p_instruction),'pending',
    jsonb_build_object('version',3,'stopKind',CASE WHEN p_disposition LIKE 'return_%' THEN 'return' ELSE 'redirect' END,
      'sourceStopId',p_stop_id,'authorisedBy',p_actor_user_id,'createdAt',v_now,'disposition',p_disposition))
  RETURNING * INTO v_follow;
  UPDATE public.job_stops SET status='cancelled',cancelled_at=v_now,updated_at=v_now,
    handover=COALESCE(handover,'{}'::jsonb) || jsonb_build_object(
      'returnInstruction',COALESCE(handover->'returnInstruction','{}'::jsonb) ||
        jsonb_build_object('resolutionRequired',false,'resolvedAt',v_now,'authorisedBy',p_actor_user_id,
          'disposition',p_disposition,'followUpStopId',v_follow.id),
      'cancellation',jsonb_build_object('goodsInCustody',true,'goodsDisposition',p_disposition,'followUpStopId',v_follow.id))
    WHERE id=p_stop_id RETURNING * INTO v_stop;
  RETURN jsonb_build_object('stop',to_jsonb(v_stop),'followUpStop',to_jsonb(v_follow));
END;
$fn$;
REVOKE ALL ON FUNCTION public.resolve_driver_goods_custody_atomic(uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_driver_goods_custody_atomic(uuid,uuid,uuid,text,text,text) TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
