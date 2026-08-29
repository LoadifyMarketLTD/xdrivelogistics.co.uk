import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260826103000_driver_availability_presence.sql'), 'utf8');
const driverApi = readFileSync(resolve(process.cwd(), 'app/api/driver/availability-presence/route.ts'), 'utf8');
const nearbyApi = readFileSync(resolve(process.cwd(), 'app/api/availability/nearby/route.ts'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'app/driver/availability/live/page.tsx'), 'utf8');

describe('opt-in availability tracking contract', () => {
  it('keeps availability location separate from job tracking and server-only', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.driver_availability_presence');
    expect(migration).toContain('REVOKE ALL ON TABLE public.driver_availability_presence FROM PUBLIC, anon, authenticated');
    expect(migration).toContain("visibility IN ('private', 'fleet', 'exchange')");
    expect(driverApi).not.toContain(".from('driver_locations')");
  });

  it('is explicit opt-in, time-bounded and cost-free', () => {
    expect(driverApi).toContain('const MAX_HOURS = 8');
    expect(driverApi).toContain("availability_status ?? '').toLowerCase() !== 'available'");
    expect(driverApi).toContain('available_until');
    expect(driverApi).not.toContain('MAPBOX');
    expect(driverApi).not.toContain('mapbox.com');
    expect(page).toContain('Start live availability');
    expect(page).toContain('Stop live availability');
    expect(page).toContain('OFF by default');
  });

  it('suppresses availability for active jobs and non-available drivers', () => {
    expect(driverApi).toContain('const ACTIVE_JOB_STATUSES = new Set([');
    expect(driverApi).toContain(".eq('assigned_driver_id', driverId)");
    expect(driverApi).toContain('Availability sharing is disabled while you have an active assigned job.');
    expect(driverApi).toContain("return NextResponse.json({ active: false, presence: null });");
    expect(nearbyApi).toContain(".select('id, company_id, status, app_access, availability_status')");
    expect(nearbyApi).toContain("availability_status ?? '').toLowerCase() === 'available'");
    expect(nearbyApi).toContain('driversWithActiveJobs');
    expect(nearbyApi).toContain('if (!eligibleDriverIds.has(driverId) || driversWithActiveJobs.has(driverId)) return [];');
  });

  it('gives exact coordinates only to the same fleet and rounded coordinates to exchange users', () => {
    expect(driverApi).toContain('Math.round(value * 100) / 100');
    expect(nearbyApi).toContain("scope: 'fleet'");
    expect(nearbyApi).toContain('lat: Number(row.exact_lat)');
    expect(nearbyApi).toContain("scope: 'exchange'");
    expect(nearbyApi).toContain('lat: Number(row.exchange_lat)');
    expect(nearbyApi).toContain("if (ownCompanies.size === 0)");
    expect(nearbyApi).not.toContain("scope: 'exchange',\n      driver_id");
  });
});
