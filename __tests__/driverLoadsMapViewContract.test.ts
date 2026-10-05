import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const loads = readFileSync(join(root, 'app/driver/loads/page.tsx'), 'utf8');
const map = readFileSync(join(root, 'app/components/workspace/MarketplaceLoadMap.tsx'), 'utf8');

describe('Driver Loads Map View contract', () => {
  it('exposes a real List/Map toggle instead of a disabled control', () => {
    expect(loads).toContain("const [viewMode, setViewMode] = useState<'list' | 'map'>('list')");
    expect(loads).toContain("onClick={() => setViewMode('map')}");
    expect(loads).toContain("onClick={() => setViewMode('list')}");
    expect(loads).not.toContain('<button type="button" disabled>Map View</button>');
  });

  it('reuses the privacy-safe marketplace radar implementation', () => {
    expect(loads).toContain("import MarketplaceLoadMap from '../../components/workspace/MarketplaceLoadMap'");
    expect(loads).toContain('<MarketplaceLoadMap');
    expect(loads).toContain('pickupPostcode: load.pickup_postcode_area');
    expect(loads).toContain('deliveryPostcode: load.delivery_postcode_area');
    expect(map).toContain('Pre-award radar routes use public pickup and delivery postcode/outcode centroids only.');
    expect(map).toContain('Exact collection/delivery coordinates and private execution details remain protected');
  });

  it('keeps quote and details actions reachable from the map', () => {
    expect(loads).toContain('onQuote={(loadId) => { setViewMode(\'list\')');
    expect(loads).toContain('setBidLoadId(loadId)');
    expect(loads).toContain('onDetails={(loadId) => router.push');
  });
});
