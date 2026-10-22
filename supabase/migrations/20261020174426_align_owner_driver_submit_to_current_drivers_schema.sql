BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $do$
DECLARE
  v_oid oid;
  v_definition text;
  v_segment text;
  v_start integer;
  v_end integer;
  v_new_block text := $block$IF v_driver_id IS NULL THEN
      INSERT INTO public.drivers (
        company_id,
        user_id,
        name,
        full_name,
        display_name,
        phone,
        email,
        reg_number,
        status,
        is_active,
        app_access,
        availability_status,
        driver_type,
        can_commercial_bid
      )
      VALUES (
        v_company_id,
        v_app.user_id,
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        NULLIF(trim(v_app.payload->>'phone'), ''),
        COALESCE(NULLIF(trim(v_app.payload->>'email'), ''), v_app.email),
        NULLIF(trim(v_app.payload->>'registration'), ''),
        'active',
        true,
        true,
        'offline',
        'owner_driver',
        true
      );
    ELSE
      UPDATE public.drivers
      SET company_id = v_company_id,
          name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), name),
          full_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), full_name),
          display_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), display_name),
          phone = COALESCE(NULLIF(trim(v_app.payload->>'phone'), ''), phone),
          email = COALESCE(NULLIF(trim(v_app.payload->>'email'), ''), email),
          reg_number = COALESCE(NULLIF(trim(v_app.payload->>'registration'), ''), reg_number),
          status = 'active',
          is_active = true,
          app_access = true,
          driver_type = 'owner_driver',
          can_commercial_bid = true,
          updated_at = now()
      WHERE id = v_driver_id;
    END IF;

    $block$;
BEGIN
  v_oid := to_regprocedure(
    'public.submit_onboarding_application_base_v1_legacy_20260927(uuid)'
  );

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Legacy owner-driver submit function is missing.'
      USING ERRCODE = '42883';
  END IF;

  SELECT pg_get_functiondef(v_oid)
  INTO v_definition;

  IF regexp_count(v_definition, 'IF[[:space:]]+v_driver_id[[:space:]]+IS[[:space:]]+NULL[[:space:]]+THEN', 1, 'i') <> 1
     OR regexp_count(v_definition, 'UPDATE[[:space:]]+public\.owner_driver_vehicles', 1, 'i') <> 1 THEN
    RAISE EXCEPTION 'Unexpected owner-driver provisioning block shape; refusing rewrite.'
      USING ERRCODE = 'P0001';
  END IF;

  v_start := position('IF v_driver_id IS NULL THEN' IN v_definition);
  v_end := position('UPDATE public.owner_driver_vehicles' IN v_definition);

  IF v_start = 0 OR v_end = 0 OR v_end <= v_start THEN
    RAISE EXCEPTION 'Could not isolate owner-driver provisioning block.'
      USING ERRCODE = 'P0001';
  END IF;

  v_segment := substring(v_definition FROM v_start FOR v_end - v_start);

  IF position('residential_address' IN v_segment) = 0
     AND position('right_to_work_status' IN v_segment) = 0
     AND position('visa_expiry' IN v_segment) = 0 THEN
    IF position('driver_type' IN v_segment) > 0
       AND position('can_commercial_bid' IN v_segment) > 0 THEN
      RETURN;
    END IF;

    RAISE EXCEPTION 'Owner-driver provisioning block is neither known stale nor canonical.'
      USING ERRCODE = 'P0001';
  END IF;

  v_definition :=
    substring(v_definition FROM 1 FOR v_start - 1)
    || v_new_block
    || substring(v_definition FROM v_end);

  IF position('residential_address' IN substring(v_definition FROM v_start FOR length(v_new_block))) > 0
     OR position('right_to_work_status' IN substring(v_definition FROM v_start FOR length(v_new_block))) > 0
     OR position('visa_expiry' IN substring(v_definition FROM v_start FOR length(v_new_block))) > 0
     OR position('driver_type' IN substring(v_definition FROM v_start FOR length(v_new_block))) = 0
     OR position('can_commercial_bid' IN substring(v_definition FROM v_start FOR length(v_new_block))) = 0 THEN
    RAISE EXCEPTION 'Canonical owner-driver provisioning block validation failed.'
      USING ERRCODE = 'P0001';
  END IF;

  EXECUTE v_definition;
END;
$do$;

REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1_legacy_20260927(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
