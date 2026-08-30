BEGIN;

-- Hosted production contains canonical quote-to-vehicle attribution on job_bids,
-- but the clean migration chain did not reconstruct it before this integrity
-- migration first checks quote dependencies. Restore only the observed contract:
-- nullable UUID + FK to vehicles(id) ON DELETE SET NULL; no backfill or index.
ALTER TABLE public.job_bids
  ADD COLUMN IF NOT EXISTS quote_vehicle_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.job_bids'::regclass
      AND conname = 'job_bids_quote_vehicle_id_fkey'
  ) THEN
    ALTER TABLE public.job_bids
      ADD CONSTRAINT job_bids_quote_vehicle_id_fkey
      FOREIGN KEY (quote_vehicle_id)
      REFERENCES public.vehicles(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- Reconcile only the narrow legacy shape proven by the production audit:
-- an ACTIVE vehicle references a company row that no longer exists, is assigned
-- to a valid driver, has no dependent operational/compliance records, and the
-- same driver already has exactly one ACTIVE same-registration vehicle in the
-- driver's real company. Preserve the legacy row for history, but retire it from
-- operational use instead of deleting it.
DO $$
DECLARE
  v_candidate_count integer;
  v_repaired_count integer;
BEGIN
  WITH candidates AS (
    SELECT orphan.id
    FROM public.vehicles orphan
    JOIN public.drivers d
      ON d.id = orphan.assigned_driver_id
    LEFT JOIN public.companies orphan_company
      ON orphan_company.id = orphan.company_id
    WHERE orphan_company.id IS NULL
      AND orphan.status::text = 'active'
      AND d.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.companies dc
        WHERE dc.id = d.company_id
      )
      AND NULLIF(
        regexp_replace(upper(coalesce(orphan.reg_plate, orphan.registration, '')), '[^A-Z0-9]', '', 'g'),
        ''
      ) IS NOT NULL
      AND (
        SELECT count(*)
        FROM public.vehicles canonical
        WHERE canonical.id <> orphan.id
          AND canonical.assigned_driver_id = d.id
          AND canonical.company_id = d.company_id
          AND canonical.status::text = 'active'
          AND regexp_replace(upper(coalesce(canonical.reg_plate, canonical.registration, '')), '[^A-Z0-9]', '', 'g')
              = regexp_replace(upper(coalesce(orphan.reg_plate, orphan.registration, '')), '[^A-Z0-9]', '', 'g')
      ) = 1
      AND NOT EXISTS (SELECT 1 FROM public.vehicle_documents x WHERE x.vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.driver_locations x WHERE x.vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.jobs x WHERE x.vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.job_bids x WHERE x.quote_vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.telematics_driver_bindings x WHERE x.vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.vehicle_tracking_history x WHERE x.vehicle_id = orphan.id)
  )
  SELECT count(*) INTO v_candidate_count FROM candidates;

  IF v_candidate_count > 1 THEN
    RAISE EXCEPTION 'Vehicle integrity reconciliation found % ambiguous orphan candidates; aborting.', v_candidate_count;
  END IF;

  WITH candidates AS (
    SELECT orphan.id, d.company_id AS canonical_company_id
    FROM public.vehicles orphan
    JOIN public.drivers d
      ON d.id = orphan.assigned_driver_id
    LEFT JOIN public.companies orphan_company
      ON orphan_company.id = orphan.company_id
    WHERE orphan_company.id IS NULL
      AND orphan.status::text = 'active'
      AND d.company_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.companies dc WHERE dc.id = d.company_id)
      AND NULLIF(
        regexp_replace(upper(coalesce(orphan.reg_plate, orphan.registration, '')), '[^A-Z0-9]', '', 'g'),
        ''
      ) IS NOT NULL
      AND (
        SELECT count(*)
        FROM public.vehicles canonical
        WHERE canonical.id <> orphan.id
          AND canonical.assigned_driver_id = d.id
          AND canonical.company_id = d.company_id
          AND canonical.status::text = 'active'
          AND regexp_replace(upper(coalesce(canonical.reg_plate, canonical.registration, '')), '[^A-Z0-9]', '', 'g')
              = regexp_replace(upper(coalesce(orphan.reg_plate, orphan.registration, '')), '[^A-Z0-9]', '', 'g')
      ) = 1
      AND NOT EXISTS (SELECT 1 FROM public.vehicle_documents x WHERE x.vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.driver_locations x WHERE x.vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.jobs x WHERE x.vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.job_bids x WHERE x.quote_vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.telematics_driver_bindings x WHERE x.vehicle_id = orphan.id)
      AND NOT EXISTS (SELECT 1 FROM public.vehicle_tracking_history x WHERE x.vehicle_id = orphan.id)
  )
  UPDATE public.vehicles v
  SET
    company_id = candidates.canonical_company_id,
    assigned_driver_id = NULL,
    status = 'inactive'::public.status_enum,
    is_available = false,
    advertising_state = 'none',
    notes = concat_ws(
      E'\n',
      nullif(v.notes, ''),
      '[SYSTEM_RECONCILIATION 2026-08-30] Retired orphan duplicate vehicle record; canonical active assignment preserved.'
    ),
    updated_at = now()
  FROM candidates
  WHERE v.id = candidates.id;

  GET DIAGNOSTICS v_repaired_count = ROW_COUNT;

  IF v_candidate_count <> v_repaired_count THEN
    RAISE EXCEPTION 'Vehicle integrity reconciliation expected % repair(s) but applied %.', v_candidate_count, v_repaired_count;
  END IF;
END;
$$;

-- Fail closed if unresolved legacy corruption remains before installing guards.
DO $$
DECLARE
  v_orphan_companies integer;
  v_cross_company_assignments integer;
  v_ambiguous_active_assignments integer;
BEGIN
  SELECT count(*)
  INTO v_orphan_companies
  FROM public.vehicles v
  LEFT JOIN public.companies c ON c.id = v.company_id
  WHERE c.id IS NULL;

  SELECT count(*)
  INTO v_cross_company_assignments
  FROM public.vehicles v
  JOIN public.drivers d ON d.id = v.assigned_driver_id
  WHERE v.assigned_driver_id IS NOT NULL
    AND v.company_id IS DISTINCT FROM d.company_id;

  SELECT count(*)
  INTO v_ambiguous_active_assignments
  FROM (
    SELECT assigned_driver_id
    FROM public.vehicles
    WHERE assigned_driver_id IS NOT NULL
      AND status::text = 'active'
    GROUP BY assigned_driver_id
    HAVING count(*) > 1
  ) x;

  IF v_orphan_companies <> 0
     OR v_cross_company_assignments <> 0
     OR v_ambiguous_active_assignments <> 0 THEN
    RAISE EXCEPTION
      'Vehicle integrity precondition failed: orphan_companies=%, cross_company_assignments=%, ambiguous_active_assignments=%',
      v_orphan_companies,
      v_cross_company_assignments,
      v_ambiguous_active_assignments;
  END IF;
END;
$$;

-- Every vehicle must belong to an existing company. Keep deletion restrictive:
-- company governance must retire/migrate fleet resources before company removal.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.vehicles'::regclass
      AND conname = 'vehicles_company_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.vehicles
  VALIDATE CONSTRAINT vehicles_company_id_fkey;

-- A driver has one canonical ACTIVE assigned vehicle at a time. Fleets may keep
-- multiple active, unassigned vehicles in inventory; this only protects the
-- driver assignment identity used by quoting/execution eligibility.
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_one_active_assignment_per_driver_uidx
  ON public.vehicles (assigned_driver_id)
  WHERE assigned_driver_id IS NOT NULL
    AND status = 'active'::public.status_enum;

-- Prevent cross-company assignment even when writes arrive through an older
-- direct-Supabase client. This is deliberately DB-authoritative.
CREATE OR REPLACE FUNCTION public.guard_vehicle_assignment_company_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver_company_id uuid;
BEGIN
  IF NEW.assigned_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.company_id
  INTO v_driver_company_id
  FROM public.drivers d
  WHERE d.id = NEW.assigned_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assigned driver does not exist.' USING ERRCODE = '23503';
  END IF;

  IF v_driver_company_id IS NULL OR NEW.company_id IS DISTINCT FROM v_driver_company_id THEN
    RAISE EXCEPTION 'Vehicle and assigned driver must belong to the same company.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_vehicle_assignment_company_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_vehicle_assignment_company_integrity() FROM anon;
REVOKE ALL ON FUNCTION public.guard_vehicle_assignment_company_integrity() FROM authenticated;

DROP TRIGGER IF EXISTS trg_vehicles_assignment_company_integrity ON public.vehicles;
CREATE TRIGGER trg_vehicles_assignment_company_integrity
BEFORE INSERT OR UPDATE OF company_id, assigned_driver_id
ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.guard_vehicle_assignment_company_integrity();

-- Migration-level proof: final production/replay state must satisfy all three
-- canonical Driver↔Vehicle↔Company invariants.
DO $$
DECLARE
  v_orphan_companies integer;
  v_cross_company_assignments integer;
  v_ambiguous_active_assignments integer;
BEGIN
  SELECT count(*)
  INTO v_orphan_companies
  FROM public.vehicles v
  LEFT JOIN public.companies c ON c.id = v.company_id
  WHERE c.id IS NULL;

  SELECT count(*)
  INTO v_cross_company_assignments
  FROM public.vehicles v
  JOIN public.drivers d ON d.id = v.assigned_driver_id
  WHERE v.assigned_driver_id IS NOT NULL
    AND v.company_id IS DISTINCT FROM d.company_id;

  SELECT count(*)
  INTO v_ambiguous_active_assignments
  FROM (
    SELECT assigned_driver_id
    FROM public.vehicles
    WHERE assigned_driver_id IS NOT NULL
      AND status::text = 'active'
    GROUP BY assigned_driver_id
    HAVING count(*) > 1
  ) x;

  IF v_orphan_companies <> 0
     OR v_cross_company_assignments <> 0
     OR v_ambiguous_active_assignments <> 0 THEN
    RAISE EXCEPTION
      'Vehicle integrity verification failed: orphan_companies=%, cross_company_assignments=%, ambiguous_active_assignments=%',
      v_orphan_companies,
      v_cross_company_assignments,
      v_ambiguous_active_assignments;
  END IF;
END;
$$;

COMMIT;
