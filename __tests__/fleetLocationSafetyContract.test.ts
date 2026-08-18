import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('fleet location rendering safety', () => {
  it('guards coordinates before formatting them', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/admin/fleet/resources/page.tsx'), 'utf8');

    expect(source).toContain('const hasValidCoordinates');
    expect(source).toContain('const locationHasCoordinates = hasValidCoordinates(location);');
    expect(source).toContain("const trackingState: 'live' | 'stale' | 'missing' = !locationHasCoordinates");
    expect(source).toContain('row.locationHasCoordinates ?');
    expect(source).toContain('No valid coordinates');
  });
});
