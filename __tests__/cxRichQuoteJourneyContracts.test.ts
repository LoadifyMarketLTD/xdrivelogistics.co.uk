import fs from 'node:fs';
import path from 'node:path';

describe('CX parity rich quote and journey contracts', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260828114000_cx_parity_driver_exchange_contracts.sql'),
    'utf8',
  );
  const quote = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/_lib/submitQuote.ts'), 'utf8');
  const bids = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/bids/route.ts'), 'utf8');
  const resources = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/resources/route.ts'), 'utf8');

  it('stores collection ETA, extras and selected vehicle as structured bid fields', () => {
    expect(migration).toContain('collect_within_minutes');
    expect(migration).toContain('additional_extras_gbp');
    expect(migration).toContain('quoted_vehicle_id');
    expect(quote).toContain('collect_within_minutes: collectWithinMinutes');
    expect(quote).toContain('additional_extras_gbp: additionalExtrasGbp');
    expect(quote).toContain('quoted_vehicle_id: vehicleId');
    expect(bids).toContain('quotedVehicleLabel');
  });

  it('validates that a quoted vehicle belongs to the authenticated driver', () => {
    expect(quote).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(quote).toContain('The selected vehicle is not assigned to your driver account.');
  });

  it('supports Going Home, Going To and Future Journey with capacity metadata', () => {
    expect(migration).toContain("('going_home','going_to','future')");
    expect(migration).toContain('go_anywhere');
    expect(migration).toContain('via_location');
    expect(migration).toContain('journey_eta');
    expect(migration).toContain('weight_available_kg');
    expect(migration).toContain('pallet_space_available');
    expect(resources).toContain("rpc('replace_driver_return_journey_v2'");
  });

  it('persists alert preferences and default search filters server-side', () => {
    expect(migration).toContain('driver_alert_preferences');
    expect(migration).toContain('driver_search_filter_defaults');
    expect(resources).toContain("action === 'save_alert_preferences'");
    expect(resources).toContain("action === 'save_search_filter_defaults'");
  });
});
