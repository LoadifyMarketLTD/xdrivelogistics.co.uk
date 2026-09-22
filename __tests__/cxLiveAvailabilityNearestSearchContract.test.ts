import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX Live Availability nearest search contract', () => {
  const page = read('app/admin/live-availability/page.tsx');
  const api = read('app/api/availability/nearby/route.ts');

  it('supports postcode/outcode + radius nearest discovery', () => {
    expect(page).toContain('Near postcode / outcode');
    expect(page).toContain('Find Nearest');
    expect(page).toContain('nearbyRadius');
    expect(api).toContain("searchParams.get('postcode')");
    expect(api).toContain("searchParams.get('radiusMiles')");
    expect(api).toContain('api.postcodes.io');
    expect(api).toContain('distanceMiles');
  });

  it('filters and sorts server-side using the privacy-scoped coordinates already allowed by the API', () => {
    expect(api).toContain('position.lat');
    expect(api).toContain('position.lng');
    expect(api).toContain('distance_miles');
    expect(api).toContain('distance_miles <= radiusMiles');
    expect(api).toContain('Exchange discovery deliberately exposes');
  });

  it('does not expose Exchange driver identity while adding nearest distance', () => {
    expect(page).toContain('driver identity is not disclosed');
    expect(api).not.toContain("scope: 'exchange',\n      driver_id");
    expect(page).toContain('position.distance_miles');
  });
});
