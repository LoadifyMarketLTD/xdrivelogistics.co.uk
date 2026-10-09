import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Future Availability parity completion', () => {
  const migration = read('supabase/migrations/20261009153000_complete_future_availability_window.sql');
  const driverApi = read('app/api/driver/future-position/route.ts');
  const adminApi = read('app/api/admin/drivers/[id]/future-position/route.ts');
  const driverReturns = read('app/driver/returns/page.tsx');
  const driverAvailability = read('app/driver/availability/page.tsx');
  const intelligenceApi = read('app/api/workspace/operations-intelligence/route.ts');
  const intelligenceHook = read('app/components/workspace/useOperationsIntelligence.ts');
  const fleetResources = read('app/admin/fleet/resources/page.tsx');
  const futurePage = read('app/admin/fleet/future-availability/page.tsx');
  const livePage = read('app/admin/live-availability/page.tsx');

  it('extends the existing future-position declaration with a window end and operational notes', () => {
    expect(migration).toContain('future_position_until timestamptz');
    expect(migration).toContain('future_availability_notes text');
    for (const source of [driverApi, adminApi]) {
      expect(source).toContain('future_position_until');
      expect(source).toContain('future_availability_notes');
      expect(source).toContain('Future-position end must be after the start.');
    }
  });

  it('keeps Driver/Owner Driver self-service and company Fleet operator management on their existing authorised endpoints', () => {
    expect(driverReturns).toContain("fetch('/api/driver/future-position'");
    expect(driverReturns).toContain('Available until');
    expect(driverReturns).toContain('Availability notes');
    expect(adminApi).toContain('requireCompanyFleetOperator');
    expect(fleetResources).toContain('/api/admin/drivers/${encodeURIComponent(futureDriverId)}/future-position');
    expect(fleetResources).toContain('Available until');
    expect(fleetResources).toContain('Capacity / timing notes');
  });

  it('carries the completed declaration through shared operations intelligence', () => {
    expect(intelligenceApi).toContain('future_position_until,future_availability_notes');
    expect(intelligenceApi).toContain('futurePositionUntil');
    expect(intelligenceHook).toContain('futurePositionUntil: string | null');
    expect(intelligenceHook).toContain('notes: string | null');
  });

  it('shows future availability windows, assigned vehicle capacity and notes in Fleet planning surfaces', () => {
    expect(futurePage).toContain('Published future capacity');
    expect(futurePage).toContain('Vehicle / capacity');
    expect(futurePage).toContain('Published future positions');
    expect(livePage).toContain('Availability window');
    expect(livePage).toContain('Vehicle / capacity');
    expect(livePage).toContain('future.futurePositionUntil');
    expect(livePage).toContain('future?.notes');
  });

  it('exposes the completed future declaration in the Driver availability summary', () => {
    expect(driverAvailability).toContain('future_position_until');
    expect(driverAvailability).toContain('future_availability_notes');
    expect(driverAvailability).toContain('<dt>Until</dt>');
    expect(driverAvailability).toContain('<dt>Notes</dt>');
  });
});
