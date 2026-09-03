-- Forward-only maintenance migration: remove exact duplicate indexes without
-- changing constraints, uniqueness predicates, RLS, or business semantics.
--
-- Every pair is verified fail-closed before the redundant copy is dropped:
--   * both survivor and redundant index must exist;
--   * normalized pg_get_indexdef() must match exactly;
--   * the redundant copy must not back a PK/UNIQUE/EXCLUDE constraint.

DO $$
DECLARE
  r record;
  survivor_oid regclass;
  redundant_oid regclass;
  survivor_def text;
  redundant_def text;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('idx_company_members_user_id', 'company_members_user_idx'),
      ('idx_driver_device_tokens_driver_id', 'driver_device_tokens_driver_idx'),
      ('idx_drivers_company_id', 'drivers_company_id_idx'),
      ('idx_invoices_company_id', 'invoices_company_id_idx'),
      ('idx_job_bids_bidder_company_id', 'idx_job_bids_bidder_company'),
      ('idx_job_bids_bidder_company_id', 'job_bids_bidder_company_id_idx'),
      ('idx_job_bids_bidder_user_id', 'idx_job_bids_bidder_user'),
      ('idx_job_bids_status', 'job_bids_status_idx'),
      ('job_bids_one_active_company_quote_per_job_uidx', 'job_bids_active_company_unique_idx'),
      ('job_bids_one_active_independent_quote_per_job_uidx', 'job_bids_active_null_company_unique_idx'),
      ('idx_job_documents_load_id', 'job_documents_load_id_idx'),
      ('idx_job_notes_company_id', 'job_notes_company_id_idx'),
      ('idx_job_notes_job_id', 'job_notes_job_id_idx'),
      ('idx_jobs_assigned_company_id', 'idx_jobs_assigned_to'),
      ('idx_vehicle_tracking_history_vehicle_id', 'idx_tracking_history_vehicle_id'),
      ('idx_vehicles_company_id', 'idx_vehicles_company')
    ) AS pairs(survivor_name, redundant_name)
  LOOP
    survivor_oid := to_regclass(format('public.%I', r.survivor_name));
    redundant_oid := to_regclass(format('public.%I', r.redundant_name));

    IF survivor_oid IS NULL THEN
      RAISE EXCEPTION 'Duplicate-index consolidation preflight failed: survivor % is missing', r.survivor_name;
    END IF;

    IF redundant_oid IS NULL THEN
      RAISE EXCEPTION 'Duplicate-index consolidation preflight failed: redundant copy % is missing', r.redundant_name;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conindid = redundant_oid
    ) THEN
      RAISE EXCEPTION 'Duplicate-index consolidation preflight failed: % backs a constraint', r.redundant_name;
    END IF;

    survivor_def := regexp_replace(
      pg_get_indexdef(survivor_oid),
      'INDEX [^ ]+ ON ',
      'INDEX ON '
    );
    redundant_def := regexp_replace(
      pg_get_indexdef(redundant_oid),
      'INDEX [^ ]+ ON ',
      'INDEX ON '
    );

    IF survivor_def IS DISTINCT FROM redundant_def THEN
      RAISE EXCEPTION
        'Duplicate-index consolidation preflight failed: % and % are not structurally identical',
        r.survivor_name,
        r.redundant_name;
    END IF;

    EXECUTE format('DROP INDEX public.%I', r.redundant_name);
  END LOOP;
END;
$$;

-- Preserve the two canonical Marketplace fairness indexes explicitly because
-- repository tests and migration contracts refer to these semantic names.
DO $$
BEGIN
  IF to_regclass('public.job_bids_one_active_company_quote_per_job_uidx') IS NULL THEN
    RAISE EXCEPTION 'Canonical active company quote index is missing after consolidation';
  END IF;

  IF to_regclass('public.job_bids_one_active_independent_quote_per_job_uidx') IS NULL THEN
    RAISE EXCEPTION 'Canonical active independent quote index is missing after consolidation';
  END IF;
END;
$$;
