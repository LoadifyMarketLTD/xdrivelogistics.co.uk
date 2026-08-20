-- Real-database PreLive P1 Fleet resource reservation regression test.
-- Run only against a disposable/local/staging database after all migrations.
-- Fixture setup temporarily disables USER triggers on the fixture tables, then
-- the actual guard function is exercised through a disposable temp-table trigger.
-- Constraints/FKs remain authoritative and the transaction is always rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
END;
$$;

SELECT pg_temp.assert_true(
  to_regprocedure('public.guard_job_resource_double_booking()') IS NOT NULL,
  'Canonical Fleet double-booking guard function is missing.'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.jobs'::regclass
      AND tgname = 'trg_guard_job_resource_double_booking'
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  ),
  'Canonical Fleet double-booking trigger is missing or disabled.'
);

INSERT INTO public.companies (id, name, status)
VALUES (
  '23000000-0000-0000-0000-000000000001',
  'PreLive Fleet Guard Company',
  'active'
);

ALTER TABLE public.drivers DISABLE TRIGGER USER;
ALTER TABLE public.vehicles DISABLE TRIGGER USER;
ALTER TABLE public.jobs DISABLE TRIGGER USER;

-- Fresh/live XDrive physical contract requires the legacy name/full_name fields
-- as well as canonical display_name. Populate all identity fields plus is_active
-- so this fixture reaches the Fleet reservation guard instead of failing on an
-- unrelated Driver row constraint.
INSERT INTO public.drivers (
  id,
  company_id,
  name,
  full_name,
  display_name,
  status,
  is_active,
  app_access,
  driver_type,
  can_commercial_bid
)
VALUES
  (
    '23000000-0000-0000-0000-000000000011',
    '23000000-0000-0000-0000-000000000001',
    'PreLive Driver One',
    'PreLive Driver One',
    'PreLive Driver One',
    'pending_verification',
    true,
    false,
    'company_driver',
    false
  ),
  (
    '23000000-0000-0000-0000-000000000012',
    '23000000-0000-0000-0000-000000000001',
    'PreLive Driver Two',
    'PreLive Driver Two',
    'PreLive Driver Two',
    'pending_verification',
    true,
    false,
    'company_driver',
    false
  );

-- Vehicle creation in the live application explicitly starts advertising_state
-- at 'none'. Mirror that physical contract so this fixture tests Fleet locking,
-- not an unrelated advertising NOT NULL constraint.
INSERT INTO public.vehicles (
  id, company_id, assigned_driver_id, type, reg_plate, advertising_state
)
VALUES (
  '23000000-0000-0000-0000-000000000021',
  '23000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000011',
  'van_small',
  'PL26TST',
  'none'
);

INSERT INTO public.jobs (
  id,
  company_id,
  assigned_driver_id,
  vehicle_id,
  status,
  current_status,
  pickup_datetime,
  delivery_datetime,
  payment_terms
)
VALUES (
  '23000000-0000-0000-0000-000000000031',
  '23000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000011',
  '23000000-0000-0000-0000-000000000021',
  'allocated',
  'allocated',
  '2026-08-20 12:00:00+00',
  '2026-08-20 14:00:00+00',
  '14 days'
);

ALTER TABLE public.drivers ENABLE TRIGGER USER;
ALTER TABLE public.vehicles ENABLE TRIGGER USER;
ALTER TABLE public.jobs ENABLE TRIGGER USER;

CREATE TEMP TABLE prelive_job_guard_probe (
  id uuid NOT NULL,
  assigned_driver_id uuid,
  vehicle_id uuid,
  current_status text,
  status text,
  pickup_datetime timestamptz,
  delivery_datetime timestamptz,
  job_distance_minutes integer
) ON COMMIT DROP;

CREATE TRIGGER trg_prelive_job_guard_probe
BEFORE INSERT ON prelive_job_guard_probe
FOR EACH ROW
EXECUTE FUNCTION public.guard_job_resource_double_booking();

DO $$
BEGIN
  BEGIN
    INSERT INTO prelive_job_guard_probe (
      id, assigned_driver_id, vehicle_id, current_status, status,
      pickup_datetime, delivery_datetime
    ) VALUES (
      '23000000-0000-0000-0000-000000000041',
      '23000000-0000-0000-0000-000000000011',
      NULL,
      'allocated',
      'allocated',
      '2026-08-20 13:00:00+00',
      '2026-08-20 15:00:00+00'
    );
    RAISE EXCEPTION 'Overlapping Driver allocation unexpectedly succeeded.';
  EXCEPTION
    WHEN check_violation THEN
      IF position('already reserved by job' in SQLERRM) = 0 THEN
        RAISE;
      END IF;
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO prelive_job_guard_probe (
      id, assigned_driver_id, vehicle_id, current_status, status,
      pickup_datetime, delivery_datetime
    ) VALUES (
      '23000000-0000-0000-0000-000000000042',
      '23000000-0000-0000-0000-000000000012',
      '23000000-0000-0000-0000-000000000021',
      'allocated',
      'allocated',
      '2026-08-20 13:00:00+00',
      '2026-08-20 13:30:00+00'
    );
    RAISE EXCEPTION 'Overlapping Vehicle allocation unexpectedly succeeded.';
  EXCEPTION
    WHEN check_violation THEN
      IF position('already reserved by job' in SQLERRM) = 0 THEN
        RAISE;
      END IF;
  END;
END;
$$;

INSERT INTO prelive_job_guard_probe (
  id, assigned_driver_id, vehicle_id, current_status, status,
  pickup_datetime, delivery_datetime
) VALUES (
  '23000000-0000-0000-0000-000000000043',
  '23000000-0000-0000-0000-000000000011',
  '23000000-0000-0000-0000-000000000021',
  'allocated',
  'allocated',
  '2026-08-20 15:00:00+00',
  '2026-08-20 16:00:00+00'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM prelive_job_guard_probe
    WHERE id = '23000000-0000-0000-0000-000000000043'
  ),
  'Non-overlapping Driver/Vehicle reservation was incorrectly rejected.'
);

SELECT pass('Fleet Driver/Vehicle double-booking DB guard passed.');
SELECT * FROM finish();
ROLLBACK;
