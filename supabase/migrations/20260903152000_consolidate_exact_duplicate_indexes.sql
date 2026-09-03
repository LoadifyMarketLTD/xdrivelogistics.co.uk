-- Forward-only maintenance migration: remove exact duplicate indexes without
-- changing constraints, uniqueness predicates, RLS, or business semantics.
--
-- This migration is intentionally drift-tolerant between clean replay and the
-- hosted Production schema. A listed candidate is dropped only when:
--   * that candidate exists;
--   * it does not back a PK/UNIQUE/EXCLUDE constraint; and
--   * another structurally identical index exists on the same table.
-- If a candidate is absent, or is the only copy in that environment, it is
-- preserved. This prevents a cleanup from removing the sole useful index.

DO $$
DECLARE
  r record;
  candidate_oid oid;
  table_oid oid;
  candidate_def text;
  duplicate_oid oid;
BEGIN
  FOR r IN
    SELECT redundant_name
    FROM (VALUES
      -- Production-only / hosted duplicate copies.
      ('company_members_user_idx'),
      ('driver_device_tokens_driver_idx'),
      ('idx_drivers_company_id'),
      ('idx_invoices_company_id'),
      ('idx_job_bids_bidder_company'),
      ('job_bids_bidder_company_id_idx'),
      ('idx_job_bids_bidder_user'),
      ('idx_job_bids_status'),
      ('job_bids_active_company_unique_idx'),
      ('job_bids_active_null_company_unique_idx'),
      ('job_documents_load_id_idx'),
      ('idx_job_notes_company_id'),
      ('idx_job_notes_job_id'),
      ('idx_jobs_assigned_to'),
      ('idx_tracking_history_vehicle_id'),
      ('idx_vehicles_company_id'),

      -- Clean-replay duplicate copies not currently duplicated in Production.
      ('job_bids_active_company_job_unique'),
      ('idx_jobs_assigned_driver_id'),
      ('idx_return_journeys_company_id')
    ) AS candidates(redundant_name)
  LOOP
    candidate_oid := to_regclass(format('public.%I', r.redundant_name));
    IF candidate_oid IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conindid = candidate_oid
    ) THEN
      RAISE EXCEPTION 'Duplicate-index consolidation preflight failed: % backs a constraint', r.redundant_name;
    END IF;

    SELECT i.indrelid
      INTO table_oid
    FROM pg_index i
    WHERE i.indexrelid = candidate_oid;

    candidate_def := regexp_replace(
      pg_get_indexdef(candidate_oid),
      'INDEX [^ ]+ ON ',
      'INDEX ON '
    );

    SELECT i.indexrelid
      INTO duplicate_oid
    FROM pg_index i
    WHERE i.indrelid = table_oid
      AND i.indexrelid <> candidate_oid
      AND regexp_replace(
        pg_get_indexdef(i.indexrelid),
        'INDEX [^ ]+ ON ',
        'INDEX ON '
      ) = candidate_def
    ORDER BY i.indexrelid
    LIMIT 1;

    -- A sole index is not redundant in this environment. Preserve it.
    IF duplicate_oid IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP INDEX public.%I', r.redundant_name);
  END LOOP;
END;
$$;

-- These semantic Marketplace fairness names are repository contracts and must
-- remain available wherever the job_bids table exists.
DO $$
BEGIN
  IF to_regclass('public.job_bids') IS NOT NULL THEN
    IF to_regclass('public.job_bids_one_active_company_quote_per_job_uidx') IS NULL THEN
      RAISE EXCEPTION 'Canonical active company quote index is missing after consolidation';
    END IF;

    IF to_regclass('public.job_bids_one_active_independent_quote_per_job_uidx') IS NULL THEN
      RAISE EXCEPTION 'Canonical active independent quote index is missing after consolidation';
    END IF;
  END IF;
END;
$$;
