-- Remove the legacy `received` value from the driver-assignment trigger.
-- jobs.status is a job_status enum and evaluating that invalid literal raises
-- before the award/allocation transaction can complete.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_auto_allocate_on_driver_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_driver_id IS NOT NULL
     AND NEW.assigned_driver_id IS DISTINCT FROM OLD.assigned_driver_id
     AND NEW.status::text IN ('draft', 'posted', 'quoted', 'awarded')
  THEN
    NEW.status := 'allocated';
    NEW.current_status := 'allocated';
    NEW.assigned_company_id := coalesce(
      NEW.assigned_company_id,
      NEW.awarded_carrier_company_id
    );
    NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb)
      || jsonb_build_object(
        'status', 'allocated',
        'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'source', 'driver_assignment_trigger'
      );
  END IF;

  IF NEW.assigned_driver_id IS NULL
     AND OLD.assigned_driver_id IS NOT NULL
     AND NEW.status::text = 'allocated'
  THEN
    NEW.status := CASE
      WHEN NEW.awarded_carrier_company_id IS NOT NULL THEN 'awarded'
      ELSE 'posted'
    END;
    NEW.current_status := NEW.status::text;
    IF NEW.awarded_carrier_company_id IS NULL THEN
      NEW.assigned_company_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_auto_allocate_on_driver_assign() IS
  'Auto-allocates canonical pre-execution jobs when a driver is assigned; contains no legacy received status.';

NOTIFY pgrst, 'reload schema';

COMMIT;
