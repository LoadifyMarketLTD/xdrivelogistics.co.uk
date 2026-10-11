import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('app/driver/loads/page.tsx', 'utf8');

describe('Driver Loads CX refinement contract', () => {
  it('uses CX-style commercial timing labels instead of raw service_mode labels', () => {
    expect(source).toContain("return timed ? 'Same Day - Timed' : 'Same Day - Non Timed'");
    expect(source).toContain("return timed ? 'Next Day - Timed' : 'Next Day - Non Timed'");
    expect(source).toContain('{commercialTimingLabel(load)}');
  });

  it('preserves the approved pickup location search without an unapproved radius control', () => {
    expect(source).toContain('pickupFilter');
    expect(source).not.toContain('radiusMilesFilter');
    expect(source).not.toContain('aria-label="Pickup radius"');
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
