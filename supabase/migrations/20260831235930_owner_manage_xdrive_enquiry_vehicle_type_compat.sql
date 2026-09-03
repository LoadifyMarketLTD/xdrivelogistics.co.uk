BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Align the hosted vehicle_type enum with the full canonical XDrive transport
-- taxonomy used by job posting, Driver loads, search and enquiry conversion.
-- Legacy labels are intentionally preserved for existing rows. New XDrive
-- enquiry conversions persist the exact canonical type; no downgrade/fallback
-- to vans, 7.5T, artic or any other broader category is permitted.

DO $preflight$
BEGIN
  IF to_regtype('public.vehicle_type') IS NULL THEN
    RAISE EXCEPTION 'public.vehicle_type must exist before XDrive enquiry vehicle taxonomy alignment.' USING ERRCODE = '23514';
  END IF;
END;
$preflight$;

DO $enum_alignment$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'bicycle') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'bicycle';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'motorbike') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'motorbike';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'car') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'car';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'van_small') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'van_small';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'van_large') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'van_large';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'truck_7_5t') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'truck_7_5t';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = 'truck_18t') THEN
    ALTER TYPE public.vehicle_type ADD VALUE 'truck_18t';
  END IF;
END;
$enum_alignment$;

COMMIT;

-- Verify after commit because newly-added enum labels cannot be used in the same
-- transaction that introduced them on all supported PostgreSQL versions.
DO $verify_full_taxonomy$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required.label ORDER BY required.ord)
  INTO v_missing
  FROM (
    VALUES
      (1, 'bicycle'), (2, 'motorbike'), (3, 'car'),
      (4, 'van_small'), (5, 'van_large'), (6, 'swb_van'), (7, 'mwb_van'), (8, 'lwb_van'), (9, 'xlwb_van'),
      (10, 'luton'), (11, 'luton_tail_lift'), (12, 'curtainside_van'),
      (13, 'truck_3_5t'), (14, 'truck_5t'), (15, 'truck_7_5t'), (16, 'truck_12t'), (17, 'truck_18t'), (18, 'truck_26t'),
      (19, 'artic'), (20, 'artic_44t_curtainsider'), (21, 'artic_44t_box_trailer'), (22, 'artic_44t_flatbed'),
      (23, 'artic_44t_refrigerated'), (24, 'artic_44t_double_deck'),
      (25, 'hiab'), (26, 'moffett'), (27, 'adr_vehicle'), (28, 'refrigerated_vehicle'), (29, 'temperature_controlled_vehicle')
  ) AS required(ord, label)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    WHERE e.enumtypid = 'public.vehicle_type'::regtype
      AND e.enumlabel = required.label
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'XDrive vehicle taxonomy alignment incomplete. Missing: %', array_to_string(v_missing, ', ')
      USING ERRCODE = '23514';
  END IF;
END;
$verify_full_taxonomy$;

NOTIFY pgrst, 'reload schema';
