-- ============================================================
-- Danny Courier Ltd — SCHEMA VERIFICATION (read-only)
-- ============================================================
-- Paste into Supabase SQL Editor and click Run.
-- Safe read-only query — makes NO changes to the database.
-- All sections should return 0 rows on a healthy database.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1) MISSING TABLES
-- ──────────────────────────────────────────────────────────────
SELECT 'MISSING TABLE' AS issue, t AS table_name
FROM (VALUES
  ('profiles'),
  ('companies'),
  ('company_memberships'),
  ('drivers'),
  ('vehicles'),
  ('driver_documents'),
  ('vehicle_documents'),
  ('jobs'),
  ('job_documents'),
  ('job_notes'),
  ('job_tracking_events'),
  ('job_bids'),
  ('driver_locations'),
  ('job_driver_distance_cache'),
  ('quotes'),
  ('diary_events'),
  ('return_journeys')
) AS required(t)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = t
);

-- ──────────────────────────────────────────────────────────────
-- 2) MISSING COLUMNS
-- ──────────────────────────────────────────────────────────────
SELECT 'MISSING COLUMN' AS issue, c.table_name, c.column_name
FROM (VALUES
  -- profiles
  ('profiles',            'id'),
  ('profiles',            'full_name'),
  ('profiles',            'phone'),
  ('profiles',            'email'),
  ('profiles',            'role'),
  ('profiles',            'company_id'),
  ('profiles',            'is_driver'),
  ('profiles',            'created_at'),
  ('profiles',            'updated_at'),
  -- companies
  ('companies',           'id'),
  ('companies',           'name'),
  ('companies',           'email'),
  ('companies',           'phone'),
  ('companies',           'address_line1'),
  ('companies',           'address_line2'),
  ('companies',           'city'),
  ('companies',           'postcode'),
  ('companies',           'country'),
  ('companies',           'status'),
  ('companies',           'company_type'),
  ('companies',           'created_at'),
  -- company_memberships
  ('company_memberships', 'id'),
  ('company_memberships', 'company_id'),
  ('company_memberships', 'user_id'),
  ('company_memberships', 'role_in_company'),
  ('company_memberships', 'status'),
  ('company_memberships', 'created_at'),
  -- drivers
  ('drivers',             'id'),
  ('drivers',             'company_id'),
  ('drivers',             'user_id'),
  ('drivers',             'display_name'),
  ('drivers',             'phone'),
  ('drivers',             'email'),
  ('drivers',             'status'),
  ('drivers',             'created_at'),
  -- vehicles
  ('vehicles',            'id'),
  ('vehicles',            'company_id'),
  ('vehicles',            'type'),
  ('vehicles',            'reg_plate'),
  ('vehicles',            'payload_kg'),
  ('vehicles',            'pallets_capacity'),
  ('vehicles',            'has_tail_lift'),
  ('vehicles',            'has_straps'),
  ('vehicles',            'has_blankets'),
  ('vehicles',            'created_at'),
  -- jobs
  ('jobs',                'id'),
  ('jobs',                'company_id'),
  ('jobs',                'created_by'),
  ('jobs',                'status'),
  ('jobs',                'vehicle_type'),
  ('jobs',                'cargo_type'),
  ('jobs',                'pickup_location'),
  ('jobs',                'pickup_postcode'),
  ('jobs',                'delivery_location'),
  ('jobs',                'delivery_postcode'),
  ('jobs',                'pallets'),
  ('jobs',                'boxes'),
  ('jobs',                'bags'),
  ('jobs',                'items'),
  ('jobs',                'weight_kg'),
  ('jobs',                'budget_amount'),
  ('jobs',                'load_details'),
  ('jobs',                'job_distance_miles'),
  ('jobs',                'distance_to_pickup_miles'),
  ('jobs',                'created_at'),
  ('jobs',                'updated_at'),
  -- job_documents
  ('job_documents',       'id'),
  ('job_documents',       'job_id'),
  ('job_documents',       'uploaded_by'),
  ('job_documents',       'doc_type'),
  ('job_documents',       'file_path'),
  ('job_documents',       'created_at'),
  -- job_notes
  ('job_notes',           'id'),
  ('job_notes',           'job_id'),
  ('job_notes',           'company_id'),
  ('job_notes',           'created_by'),
  ('job_notes',           'note'),
  ('job_notes',           'created_at'),
  -- job_tracking_events
  ('job_tracking_events', 'id'),
  ('job_tracking_events', 'job_id'),
  ('job_tracking_events', 'created_by'),
  ('job_tracking_events', 'event_type'),
  ('job_tracking_events', 'message'),
  ('job_tracking_events', 'created_at'),
  -- job_bids
  ('job_bids',            'id'),
  ('job_bids',            'job_id'),
  ('job_bids',            'company_id'),
  ('job_bids',            'bidder_user_id'),
  ('job_bids',            'bidder_id'),
  ('job_bids',            'amount'),
  ('job_bids',            'bid_price_gbp'),
  ('job_bids',            'currency'),
  ('job_bids',            'status'),
  ('job_bids',            'created_at'),
  -- driver_locations
  ('driver_locations',    'id'),
  ('driver_locations',    'driver_id'),
  ('driver_locations',    'company_id'),
  ('driver_locations',    'lat'),
  ('driver_locations',    'lng'),
  ('driver_locations',    'updated_at'),
  ('driver_locations',    'recorded_at'),
  -- job_driver_distance_cache
  ('job_driver_distance_cache', 'id'),
  ('job_driver_distance_cache', 'job_id'),
  ('job_driver_distance_cache', 'driver_id'),
  ('job_driver_distance_cache', 'miles_to_pickup'),
  ('job_driver_distance_cache', 'computed_at'),
  -- quotes
  ('quotes',              'id'),
  ('quotes',              'company_id'),
  ('quotes',              'created_by'),
  ('quotes',              'customer_name'),
  ('quotes',              'customer_email'),
  ('quotes',              'customer_phone'),
  ('quotes',              'pickup_location'),
  ('quotes',              'delivery_location'),
  ('quotes',              'vehicle_type'),
  ('quotes',              'cargo_type'),
  ('quotes',              'amount'),
  ('quotes',              'currency'),
  ('quotes',              'status'),
  ('quotes',              'created_at'),
  -- diary_events
  ('diary_events',        'id'),
  ('diary_events',        'company_id'),
  ('diary_events',        'driver_id'),
  ('diary_events',        'title'),
  ('diary_events',        'start_at'),
  ('diary_events',        'created_at'),
  -- return_journeys
  ('return_journeys',     'id'),
  ('return_journeys',     'company_id'),
  ('return_journeys',     'driver_id'),
  ('return_journeys',     'vehicle_type'),
  ('return_journeys',     'from_postcode'),
  ('return_journeys',     'to_postcode'),
  ('return_journeys',     'notes'),
  ('return_journeys',     'status'),
  ('return_journeys',     'created_at')
) AS c(table_name, column_name)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = c.table_name
)
AND NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = c.table_name
    AND column_name  = c.column_name
);

-- ──────────────────────────────────────────────────────────────
-- 3) MISSING ENUM TYPES
-- ──────────────────────────────────────────────────────────────
SELECT 'MISSING ENUM' AS issue, e AS enum_name
FROM (VALUES
  ('company_role'),
  ('membership_status'),
  ('doc_status'),
  ('job_status'),
  ('cargo_type'),
  ('vehicle_type'),
  ('tracking_event_type')
) AS e(e)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_type
  WHERE typname = e
    AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
);

-- ──────────────────────────────────────────────────────────────
-- 4) MISSING FUNCTIONS
-- ──────────────────────────────────────────────────────────────
SELECT 'MISSING FUNCTION' AS issue, f AS function_name
FROM (VALUES
  ('is_company_member'),
  ('is_company_admin'),
  ('sync_job_bid_price')
) AS f(f)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = f
);

-- ──────────────────────────────────────────────────────────────
-- 5) MISSING TRIGGER
-- ──────────────────────────────────────────────────────────────
SELECT 'MISSING TRIGGER' AS issue, 'trg_sync_job_bid_price on job_bids' AS detail
WHERE NOT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgname = 'trg_sync_job_bid_price'
);

-- ──────────────────────────────────────────────────────────────
-- 6) RLS STATUS FOR ALL TABLES
-- ──────────────────────────────────────────────────────────────
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','companies','company_memberships',
    'drivers','vehicles','driver_documents','vehicle_documents',
    'jobs','job_documents','job_notes','job_tracking_events',
    'job_bids','driver_locations','job_driver_distance_cache',
    'quotes','diary_events','return_journeys'
  )
ORDER BY tablename;

-- ──────────────────────────────────────────────────────────────
-- 7) MISSING RLS POLICIES (key policies only)
-- ──────────────────────────────────────────────────────────────
SELECT 'MISSING POLICY' AS issue, p.tablename, p.policyname
FROM (VALUES
  ('profiles',              'profiles_select_own'),
  ('profiles',              'profiles_update_own'),
  ('companies',             'companies_select_member'),
  ('companies',             'companies_insert_admin'),
  ('companies',             'companies_update_admin'),
  ('company_memberships',   'memberships_select_member'),
  ('company_memberships',   'memberships_insert_admin'),
  ('company_memberships',   'memberships_update_admin'),
  ('drivers',               'drivers_select_member'),
  ('drivers',               'drivers_all_admin'),
  ('vehicles',              'vehicles_select_member'),
  ('vehicles',              'vehicles_all_admin'),
  ('driver_documents',      'driver_docs_select_member'),
  ('driver_documents',      'driver_docs_all_admin'),
  ('vehicle_documents',     'vehicle_docs_select_member'),
  ('vehicle_documents',     'vehicle_docs_all_admin'),
  ('jobs',                  'jobs_all_member'),
  ('job_bids',              'bids_all_member'),
  ('job_notes',             'job_notes_all_member'),
  ('quotes',                'quotes_all_member'),
  ('diary_events',          'diary_events_all_member'),
  ('return_journeys',       'return_journeys_all_member')
) AS p(tablename, policyname)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename   = p.tablename
    AND policyname  = p.policyname
);

-- ──────────────────────────────────────────────────────────────
-- 8) SUMMARY
-- ──────────────────────────────────────────────────────────────
SELECT
  'VERIFICATION COMPLETE' AS status,
  'Healthy = sections 1-5 and 7 return 0 rows; section 6 shows all tables with RLS ON.' AS note;
