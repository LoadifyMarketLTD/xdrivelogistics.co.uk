BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Converge vehicle_type to the complete canonical XDrive transport taxonomy
-- from any supported legacy or clean-replay baseline. Existing/legacy labels
-- are preserved for historical rows. New writes use the canonical labels.

DO $preflight$
BEGIN
  IF to_regtype('public.vehicle_type') IS NULL THEN
    RAISE EXCEPTION 'public.vehicle_type must exist before XDrive enquiry vehicle taxonomy alignment.' USING ERRCODE = '23514';
  END IF;
END;
$preflight$;

DO $enum_alignment$
DECLARE
  v_label text;
BEGIN
  FOREACH v_label IN ARRAY ARRAY[
    'bicycle','motorbike','car',
    'van_small','van_large','swb_van','mwb_van','lwb_van','xlwb_van','luton','luton_tail_lift','curtainside_van',
    'truck_3_5t','truck_5t','truck_7_5t','truck_12t','truck_18t','truck_26t',
    'artic','artic_44t_curtainsider','artic_44t_box_trailer','artic_44t_flatbed','artic_44t_refrigerated','artic_44t_double_deck',
    'hiab','moffett','adr_vehicle','refrigerated_vehicle','temperature_controlled_vehicle'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_enum
      WHERE enumtypid = 'public.vehicle_type'::regtype AND enumlabel = v_label
    ) THEN
      EXECUTE format('ALTER TYPE public.vehicle_type ADD VALUE %L', v_label);
    END IF;
  END LOOP;
END;
$enum_alignment$;

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
    SELECT 1 FROM pg_catalog.pg_enum e
    WHERE e.enumtypid = 'public.vehicle_type'::regtype AND e.enumlabel = required.label
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'XDrive vehicle taxonomy alignment incomplete. Missing: %', array_to_string(v_missing, ', ')
      USING ERRCODE = '23514';
  END IF;
END;
$verify_full_taxonomy$;

COMMIT;

NOTIFY pgrst, 'reload schema';
