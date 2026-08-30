BEGIN;

-- Transactional runtime proof for the vehicle integrity guards. Every deliberate
-- invalid mutation runs inside a PL/pgSQL exception subtransaction, so the
-- failing write is rolled back automatically and production data is unchanged.
DO $$
DECLARE
  v_driver_id uuid;
  v_active_vehicle_id uuid;
  v_spare_vehicle_id uuid;
  v_company_id uuid;
  v_other_company_id uuid;
  v_cross_company_guarded boolean := false;
  v_unique_assignment_guarded boolean := false;
  v_company_fk_guarded boolean := false;
BEGIN
  SELECT active.assigned_driver_id, active.id, active.company_id, spare.id
  INTO v_driver_id, v_active_vehicle_id, v_company_id, v_spare_vehicle_id
  FROM public.vehicles active
  JOIN public.drivers d
    ON d.id = active.assigned_driver_id
   AND d.company_id = active.company_id
  JOIN public.vehicles spare
    ON spare.company_id = active.company_id
   AND spare.id <> active.id
   AND spare.assigned_driver_id IS NULL
   AND spare.status::text <> 'active'
  WHERE active.assigned_driver_id IS NOT NULL
    AND active.status::text = 'active'
  ORDER BY active.created_at, spare.created_at
  LIMIT 1;

  -- Clean/replay databases may not yet contain a suitable runtime fixture. The
  -- schema migration itself remains authoritative there; production currently
  -- has a reconciled historical row that safely supplies this proof fixture.
  IF v_driver_id IS NULL OR v_active_vehicle_id IS NULL OR v_spare_vehicle_id IS NULL OR v_company_id IS NULL THEN
    RETURN;
  END IF;

  SELECT c.id
  INTO v_other_company_id
  FROM public.companies c
  WHERE c.id <> v_company_id
  ORDER BY c.created_at, c.id
  LIMIT 1;

  IF v_other_company_id IS NOT NULL THEN
    BEGIN
      UPDATE public.vehicles
      SET company_id = v_other_company_id
      WHERE id = v_active_vehicle_id;

      RAISE EXCEPTION 'Cross-company vehicle assignment was unexpectedly accepted.' USING ERRCODE = 'PZ101';
    EXCEPTION
      WHEN check_violation THEN
        v_cross_company_guarded := true;
    END;

    IF NOT v_cross_company_guarded THEN
      RAISE EXCEPTION 'Cross-company vehicle assignment guard did not execute.';
    END IF;
  END IF;

  BEGIN
    UPDATE public.vehicles
    SET assigned_driver_id = v_driver_id,
        status = 'active'::public.status_enum
    WHERE id = v_spare_vehicle_id;

    RAISE EXCEPTION 'Second ACTIVE vehicle assignment was unexpectedly accepted.' USING ERRCODE = 'PZ102';
  EXCEPTION
    WHEN unique_violation THEN
      v_unique_assignment_guarded := true;
  END;

  IF NOT v_unique_assignment_guarded THEN
    RAISE EXCEPTION 'One-active-assignment unique guard did not execute.';
  END IF;

  BEGIN
    UPDATE public.vehicles
    SET company_id = gen_random_uuid()
    WHERE id = v_spare_vehicle_id;

    RAISE EXCEPTION 'Orphan vehicle company reference was unexpectedly accepted.' USING ERRCODE = 'PZ103';
  EXCEPTION
    WHEN foreign_key_violation THEN
      v_company_fk_guarded := true;
  END;

  IF NOT v_company_fk_guarded THEN
    RAISE EXCEPTION 'Vehicle company foreign-key guard did not execute.';
  END IF;

  -- Prove the exception subtransactions left the selected rows unchanged.
  IF NOT EXISTS (
    SELECT 1
    FROM public.vehicles v
    WHERE v.id = v_active_vehicle_id
      AND v.company_id = v_company_id
      AND v.assigned_driver_id = v_driver_id
      AND v.status::text = 'active'
  ) THEN
    RAISE EXCEPTION 'Active vehicle changed during runtime verification.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vehicles v
    WHERE v.id = v_spare_vehicle_id
      AND v.company_id = v_company_id
      AND v.assigned_driver_id IS NULL
      AND v.status::text <> 'active'
  ) THEN
    RAISE EXCEPTION 'Retired vehicle changed during runtime verification.';
  END IF;
END;
$$;

COMMIT;
