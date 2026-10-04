DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'accept_job_booking_offer_atomic'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'accept_job_booking_offer_atomic not found';
  END IF;

  v_def := replace(
    v_def,
    'v_final_status:=CASE WHEN v_offer.bidder_driver_id IS NOT NULL THEN ''allocated'' ELSE ''awarded'' END;',
    'v_final_status:=CASE WHEN v_offer.bidder_driver_id IS NOT NULL THEN ''accepted'' ELSE ''awarded'' END;'
  );

  IF position('THEN ''accepted'' ELSE ''awarded''' in v_def) = 0 THEN
    RAISE EXCEPTION 'accept status replacement failed';
  END IF;

  EXECUTE v_def;
END
$$;

NOTIFY pgrst, 'reload schema';