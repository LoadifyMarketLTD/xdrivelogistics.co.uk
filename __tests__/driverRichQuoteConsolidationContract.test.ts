import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Driver rich quote consolidation contract', () => {
  it('persists structured base/extras/collect-within fields without duplicating the canonical vehicle contract', () => {
    const migration = read('supabase/migrations/20260830011635_port_driver_rich_quote_structure.sql');
    expect(migration).toContain('base_amount');
    expect(migration).toContain('collect_within_minutes');
    expect(migration).toContain('additional_extras_gbp');
    expect(migration).not.toContain('quoted_vehicle_id');
  });

  it('derives the quoted vehicle from server-authoritative operational eligibility', () => {
    const submit = read('app/api/driver/_lib/submitQuote.ts');
    expect(submit).toContain('eligibility.operational.canonicalVehicleId');
    expect(submit).toContain('quote_vehicle_id: vehicle.id');
    expect(submit).toContain('quote_vehicle_equipment: vehicle.equipment');
    expect(submit).not.toContain('input.vehicleId');
  });

  it('keeps the final commercial total distinct from base transport and extras', () => {
    const submit = read('app/api/driver/_lib/submitQuote.ts');
    expect(submit).toContain('bid_price_gbp: totalAmount');
    expect(submit).toContain('base_amount: baseAmount');
    expect(submit).toContain('additional_extras_gbp: additionalExtrasGbp');
    expect(submit).toContain('collect_within_minutes: collectWithinMinutes');
  });

  it('sends the structured quote from Expo while retaining the richer XDrive line-item UI', () => {
    const api = read('apps/driver-mobile/src/api/liveLoads.ts');
    const screen = read('apps/driver-mobile/src/live-loads/LiveLoadsScreen.tsx');
    expect(api).toContain('baseAmount: quote.baseAmount');
    expect(api).toContain('additionalExtrasGbp: quote.additionalExtrasGbp');
    expect(api).toContain('collectWithinMinutes: quote.collectWithinMinutes');
    expect(screen).toContain("numericInput('Waiting Time'");
    expect(screen).toContain("numericInput('Tolls'");
    expect(screen).toContain('Collect within (min)');
    expect(screen).toContain('computeStructuredExtras(items)');
  });
});
