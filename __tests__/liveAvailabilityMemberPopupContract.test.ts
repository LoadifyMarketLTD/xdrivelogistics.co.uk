import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Live Availability CX-style member popup', () => {
  const map = read('app/admin/fleet/FleetPositionMapClient.tsx');
  const page = read('app/admin/live-availability/page.tsx');
  const api = read('app/api/availability/nearby/route.ts');

  it('shows published vehicle capability and last received position', () => {
    for (const fragment of ['memberCode', 'vehicleType', 'bodyType', 'payloadKg', 'palletsCapacity', 'hasTailLift', 'availabilityUntil', 'formatTimestamp(point.timestamp)']) {
      expect(map).toContain(fragment);
    }
    expect(map).toContain('Book Direct');
  });

  it('limits direct booking to a disclosed Exchange company rather than private fleet position', () => {
    expect(page).toContain("position.scope === 'exchange' && position.company_id");
    expect(page).toContain('encodeURIComponent(position.company_id)');
    expect(map).toContain("point.bookingHref?.startsWith('/')");
  });

  it('preserves approximate Exchange coordinates and avoids public driver identity', () => {
    expect(api).toContain('row.exchange_lat');
    expect(api).toContain('row.exchange_lng');
    expect(api).toContain('row.exact_lat');
    expect(api).toContain("scope: 'exchange'");
    expect(page).toContain('locationScope: position.scope');
    expect(map).toContain('Approximate Exchange area (not exact GPS)');
  });
});
