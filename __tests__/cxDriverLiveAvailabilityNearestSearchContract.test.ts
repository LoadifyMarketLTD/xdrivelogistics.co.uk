import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/nearby/page.tsx'), 'utf8');

describe('CX Driver Live Availability nearest-search parity', () => {
  it('supports postcode/outcode and radius nearest discovery through the privacy-scoped API', () => {
    expect(page).toContain('Near postcode / outcode');
    expect(page).toContain('Find Nearest');
    expect(page).toContain("params.set('postcode'");
    expect(page).toContain("params.set('radiusMiles'");
    expect(page).toContain('/api/availability/nearby?${params.toString()}');
  });

  it('shows server-calculated distance without exposing exact driver identity', () => {
    expect(page).toContain('distance_miles');
    expect(page).toContain('miles from search');
    expect(page).toContain('Privacy-rounded area');
    expect(page).not.toContain('driver_id');
  });
});
