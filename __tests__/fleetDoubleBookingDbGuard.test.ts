import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260820104000_fleet_resource_double_booking_guard.sql'),
  'utf8',
);

describe('Fleet Driver/Vehicle double-booking DB guard', () => {
  it('guards every assignment path at jobs table authority', () => {
    expect(source).toContain('CREATE TRIGGER trg_guard_job_resource_double_booking');
    expect(source).toContain('BEFORE INSERT OR UPDATE OF');
    expect(source).toContain('assigned_driver_id,');
    expect(source).toContain('vehicle_id,');
    expect(source).toContain('pickup_datetime,');
    expect(source).toContain('delivery_datetime,');
    expect(source).toContain('job_distance_minutes');
  });

  it('serializes concurrent reservations by Driver then Vehicle', () => {
    expect(source).toContain("'xdrive-driver-schedule:' || NEW.assigned_driver_id::text");
    expect(source).toContain("'xdrive-vehicle-schedule:' || NEW.vehicle_id::text");
    expect(source).toContain('pg_advisory_xact_lock');
  });

  it('blocks active execution and overlapping scheduled jobs while ignoring terminal work', () => {
    expect(source).toContain("c.effective_status IN ('on_my_way', 'on_site_pickup', 'loaded', 'in_transit', 'on_site_delivery')");
    expect(source).toContain('c.pickup_datetime <= v_target_end');
    expect(source).toContain('v_target_start <= c.effective_end');
    expect(source).toContain("NOT IN ('delivered', 'completed', 'cancelled', 'invoiced', 'paid', 'disputed')");
    expect(source).toContain("USING ERRCODE = '23514'");
  });

  it('requires a schedulable pickup window before reserving resources', () => {
    expect(source).toContain('IF v_target_start IS NULL THEN');
    expect(source).toContain('Job pickup time is required before driver/vehicle allocation.');
    expect(source).toContain('Job delivery time cannot be earlier than pickup time for resource allocation.');
  });
});
