BEGIN;

-- XDrive operational rule (2026-10-04): a driver/vehicle may hold multiple
-- accepted, allocated or executing bookings. Planned timestamps can be broad,
-- customer-entered times can be approximate, and drivers may legitimately run
-- intermediate/onward/return work between scheduled collections/deliveries.
-- Therefore schedule overlap must not hard-block booking acceptance.
DROP TRIGGER IF EXISTS trg_guard_job_resource_double_booking ON public.jobs;

COMMENT ON FUNCTION public.guard_job_resource_double_booking() IS
  'Legacy hard double-booking guard retained for audit/history only. The trigger is disabled because XDrive permits multiple compatible/intermediate/onward/return bookings for the same driver or vehicle; scheduling conflicts must be advisory, not a hard booking-acceptance block.';

COMMIT;
NOTIFY pgrst, 'reload schema';