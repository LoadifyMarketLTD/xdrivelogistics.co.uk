BEGIN;


-- Hosted production uses public.status_enum for both Driver and Vehicle
-- operational state, while the clean repository replay historically left both
-- columns as text. Reconstruct the observed hosted contract before this
-- migration first requires enum casts. Never coerce unknown legacy values:
-- incompatible type labels or row values fail closed instead.
DO $$
DECLARE
  v_type_kind "char";
  v_enum_labels text[];
  v_invalid_driver_statuses text[];
  v_invalid_vehicle_statuses text[];
  v_driver_uses_status_enum boolean;
  v_vehicle_uses_status_enum boolean;
BEGIN
  IF to_regtype('public.status_enum') IS NULL THEN
    EXECUTE 'CREATE TYPE public.status_enum AS ENUM (''active'', ''inactive'', ''suspended'')';
  ELSE
    SELECT t.typtype
    INTO v_type_kind
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'status_enum';

    IF v_type_kind IS DISTINCT FROM 'e'::"char" THEN
      RAISE EXCEPTION 'public.status_enum exists but is not an enum type.';
    END IF;

    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
    INTO v_enum_labels
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'status_enum';

    IF v_enum_labels IS DISTINCT FROM ARRAY['active', 'inactive', 'suspended']::text[] THEN
      RAISE EXCEPTION
        'public.status_enum labels differ from the hosted canonical contract: %.',
        coalesce(array_to_string(v_enum_labels, ', '), '<none>');
    END IF;
  END IF;

  SELECT array_agg(DISTINCT d.status::text ORDER BY d.status::text)
  INTO v_invalid_driver_statuses
  FROM public.drivers d
  WHERE d.status IS NOT NULL
    AND d.status::text NOT IN ('active', 'inactive', 'suspended');

  IF coalesce(array_length(v_invalid_driver_statuses, 1), 0) > 0 THEN
    RAISE EXCEPTION
      'Unsupported driver status values prevent canonical status_enum reconstruction: %.',
      array_to_string(v_invalid_driver_statuses, ', ');
  END IF;

  SELECT array_agg(DISTINCT v.status::text ORDER BY v.status::text)
  INTO v_invalid_vehicle_statuses
  FROM public.vehicles v
  WHERE v.status IS NOT NULL
    AND v.status::text NOT IN ('active', 'inactive', 'suspended');

  IF coalesce(array_length(v_invalid_vehicle_statuses, 1), 0) > 0 THEN
    RAISE EXCEPTION
      'Unsupported vehicle status values prevent canonical status_enum reconstruction: %.',
      array_to_string(v_invalid_vehicle_statuses, ', ');
  END IF;

  SELECT c.udt_schema = 'public' AND c.udt_name = 'status_enum'
  INTO v_driver_uses_status_enum
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'drivers'
    AND c.column_name = 'status';

  IF NOT coalesce(v_driver_uses_status_enum, false) THEN
    EXECUTE 'ALTER TABLE public.drivers ALTER COLUMN status DROP DEFAULT';
    EXECUTE 'ALTER TABLE public.drivers ALTER COLUMN status TYPE public.status_enum USING status::text::public.status_enum';
    EXECUTE 'ALTER TABLE public.drivers ALTER COLUMN status SET DEFAULT ''active''::public.status_enum';
  END IF;

  SELECT c.udt_schema = 'public' AND c.udt_name = 'status_enum'
  INTO v_vehicle_uses_status_enum
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'vehicles'
    AND c.column_name = 'status';

  IF NOT coalesce(v_vehicle_uses_status_enum, false) THEN
    EXECUTE 'ALTER TABLE public.vehicles ALTER COLUMN status DROP DEFAULT';
    EXECUTE 'ALTER TABLE public.vehicles ALTER COLUMN status TYPE public.status_enum USING status::text::public.status_enum';
    EXECUTE 'ALTER TABLE public.vehicles ALTER COLUMN status SET DEFAULT ''active''::public.status_enum';
  END IF;
END;
$$;

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

-- vehicle_tracking_history is hosted legacy drift with no current runtime caller
-- and zero production rows. Preserve it as a dependency guard where it exists,
-- without forcing a clean repository replay to recreate the retired table.
CREATE OR REPLACE FUNCTION public.p0_vehicle_tracking_history_dependency_exists(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists boolean := false;
BEGIN
  IF to_regclass('public.vehicle_tracking_history') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.vehicle_tracking_history WHERE vehicle_id = $1)'
    INTO v_exists
    USING p_vehicle_id;

  RETURN COALESCE(v_exists, false);
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
      AND NOT public.p0_vehicle_tracking_history_dependency_exists(orphan.id)
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
      AND NOT public.p0_vehicle_tracking_history_dependency_exists(orphan.id)
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

DROP FUNCTION IF EXISTS public.p0_vehicle_tracking_history_dependency_exists(uuid);

COMMIT;