import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('app/driver/loads/page.tsx', 'utf8');

describe('Driver Loads CX refinement contract', () => {
  it('uses CX-style commercial timing labels instead of raw service_mode labels', () => {
    expect(source).toContain("return timed ? 'Same Day - Timed' : 'Same Day - Non Timed'");
    expect(source).toContain("return timed ? 'Next Day - Timed' : 'Next Day - Non Timed'");
    expect(source).toContain('{commercialTimingLabel(load)}');
  });

  it('supports a real pickup radius filter based on distance to collection', () => {
    expect(source).toContain('radiusMilesFilter');
    expect(source).toContain('load.distance_to_pickup_miles > radiusMiles');
    expect(source).toContain('aria-label="Pickup radius"');
    expect(source).toContain('100 miles');
  });

  it('exposes sorting and true previous/next pagination', () => {
    expect(source).toContain('Price high-low');
    expect(source).toContain('Price low-high');
    expect(source).toContain('Page {safePage} of {totalPages}');
    expect(source).toContain('>Previous</button>');
    expect(source).toContain('>Next</button>');
    expect(source).toContain('filteredLoads.slice(pageStart, pageEnd)');
    expect(source).not.toContain('visibleCount');
    expect(source).not.toContain('canLoadMore');
  });

  it('uses a useful fallback when live position is unavailable', () => {
    expect(source).toContain("'Current location unavailable'");
  });
});
