-- ============================================================
-- XDrive Logistics LTD — Supabase Schema Health Check
-- Run this FIRST (read-only). It reports what is missing.
-- ============================================================

-- 1) MISSING TABLES
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

-- 2) MISSING COLUMNS ON EXISTING TABLES
SELECT 'MISSING COLUMN' AS issue, col_check.table_name, col_check.column_name
FROM (VALUES
  -- profiles
  ('profiles',              'id'),
  ('profiles',              'full_name'),
  ('profiles',              'phone'),
  ('profiles',              'is_driver'),
  ('profiles',              'email'),
  ('profiles',              'role'),
  ('profiles',              'company_id'),
  ('profiles',              'created_at'),
  ('profiles',              'updated_at'),
  -- companies
  ('companies',             'id'),
  ('companies',             'name'),
  ('companies',             'status'),
  ('companies',             'company_type'),
  ('companies',             'created_at'),
  -- company_memberships
  ('company_memberships',   'id'),
  ('company_memberships',   'company_id'),
  ('company_memberships',   'user_id'),
  ('company_memberships',   'role_in_company'),
  ('company_memberships',   'status'),
  ('company_memberships',   'created_at'),
  -- drivers
  ('drivers',               'id'),
  ('drivers',               'company_id'),
  ('drivers',               'user_id'),
  ('drivers',               'display_name'),
  ('drivers',               'status'),
  ('drivers',               'created_at'),
  -- vehicles
  ('vehicles',              'id'),
  ('vehicles',              'company_id'),
  ('vehicles',              'type'),
  ('vehicles',              'reg_plate'),
  ('vehicles',              'payload_kg'),
  ('vehicles',              'pallets_capacity'),
  ('vehicles',              'created_at'),
  -- jobs
  ('jobs',                  'id'),
  ('jobs',                  'company_id'),
  ('jobs',                  'created_by'),
  ('jobs',                  'status'),
  ('jobs',                  'vehicle_type'),
  ('jobs',                  'cargo_type'),
  ('jobs',                  'pickup_location'),
  ('jobs',                  'pickup_postcode'),
  ('jobs',                  'delivery_location'),
  ('jobs',                  'delivery_postcode'),
  ('jobs',                  'pallets'),
  ('jobs',                  'boxes'),
  ('jobs',                  'bags'),
  ('jobs',                  'items'),
  ('jobs',                  'weight_kg'),
  ('jobs',                  'budget_amount'),
  ('jobs',                  'load_details'),
  ('jobs',                  'job_distance_miles'),
  ('jobs',                  'distance_to_pickup_miles'),
  ('jobs',                  'created_at'),
  ('jobs',                  'updated_at'),
  -- job_documents
  ('job_documents',         'id'),
  ('job_documents',         'job_id'),
  ('job_documents',         'uploaded_by'),
  ('job_documents',         'doc_type'),
  ('job_documents',         'file_path'),
  ('job_documents',         'created_at'),
  -- job_notes
  ('job_notes',             'id'),
  ('job_notes',             'job_id'),
  ('job_notes',             'company_id'),
  ('job_notes',             'created_by'),
  ('job_notes',             'note'),
  ('job_notes',             'created_at'),
  -- job_tracking_events
  ('job_tracking_events',   'id'),
  ('job_tracking_events',   'job_id'),
  ('job_tracking_events',   'created_by'),
  ('job_tracking_events',   'event_type'),
  ('job_tracking_events',   'message'),
  ('job_tracking_events',   'created_at'),
  -- job_bids
  ('job_bids',              'id'),
  ('job_bids',              'job_id'),
  ('job_bids',              'company_id'),
  ('job_bids',              'bidder_user_id'),
  ('job_bids',              'bidder_id'),
  ('job_bids',              'amount'),
  ('job_bids',              'bid_price_gbp'),
  ('job_bids',              'status'),
  ('job_bids',              'created_at'),
  -- driver_locations
  ('driver_locations',      'id'),
  ('driver_locations',      'driver_id'),
  ('driver_locations',      'company_id'),
  ('driver_locations',      'lat'),
  ('driver_locations',      'lng'),
  ('driver_locations',      'updated_at'),
  -- return_journeys
  ('return_journeys',       'id'),
  ('return_journeys',       'company_id'),
  ('return_journeys',       'driver_id'),
  ('return_journeys',       'from_postcode'),
  ('return_journeys',       'to_postcode'),
  ('return_journeys',       'vehicle_type'),
  ('return_journeys',       'notes'),
  ('return_journeys',       'status'),
  ('return_journeys',       'created_at'),
  -- diary_events
  ('diary_events',          'id'),
  ('diary_events',          'company_id'),
  ('diary_events',          'driver_id'),
  ('diary_events',          'title'),
  ('diary_events',          'start_at'),
  ('diary_events',          'created_at')
) AS col_check(table_name, column_name)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = col_check.table_name
)
AND NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name  = col_check.table_name
    AND column_name = col_check.column_name
);

-- 3) MISSING UNIQUE CONSTRAINT: company_memberships(company_id, user_id)
SELECT 'MISSING UNIQUE CONSTRAINT' AS issue,
       'company_memberships' AS table_name,
       'UNIQUE(company_id, user_id)' AS detail
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.table_schema    = ccu.table_schema
  WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema    = 'public'
    AND tc.table_name      = 'company_memberships'
    AND ccu.column_name    = 'user_id'
);

-- 4) MISSING FK: job_documents.job_id → jobs(id)
SELECT 'MISSING FK' AS issue,
       'job_documents.job_id -> jobs(id)' AS detail
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name
   AND kcu.table_schema   = 'public'
   AND kcu.table_name     = 'job_documents'
   AND kcu.column_name    = 'job_id'
);

-- 5) MISSING FK: job_notes.job_id → jobs(id)
SELECT 'MISSING FK' AS issue,
       'job_notes.job_id -> jobs(id)' AS detail
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'job_notes'
)
AND NOT EXISTS (
  SELECT 1
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name = kcu.constraint_name
   AND kcu.table_schema   = 'public'
   AND kcu.table_name     = 'job_notes'
   AND kcu.column_name    = 'job_id'
);

-- 6) RLS status for each table
SELECT tablename,
       CASE WHEN rowsecurity THEN 'RLS ON' ELSE 'RLS OFF' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','companies','company_memberships','drivers','vehicles',
    'driver_documents','vehicle_documents','jobs','job_documents',
    'job_notes','job_tracking_events','job_bids','driver_locations',
    'job_driver_distance_cache','quotes','diary_events','return_journeys'
  )
ORDER BY tablename;

-- 7) HEALTH CHECK COMPLETE — no rows above means schema is healthy
SELECT 'HEALTH CHECK COMPLETE' AS status,
       'If all queries above returned 0 rows, schema is healthy.' AS note;
