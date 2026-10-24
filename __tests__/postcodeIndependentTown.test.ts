import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const call = async (query = 'q=DA81NY&town=1') => {
  const { GET } = await import('../app/api/location/postcode-area/route');
  return GET(new NextRequest('https://example.test/api/location/postcode-area?' + query));
};
const feature = (postcode = 'DA8 1NY', city = 'Erith', countrycode = 'GB') => ({ properties: { postcode, city, countrycode } });
const mockProviders = (features: unknown[]) => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.hostname === 'api.postcodes.io') return Response.json({ result: { postcode: 'DA8 1NY', latitude: 51.48417, longitude: 0.169727, admin_district: 'Bexley', region: 'London', country: 'England' } });
    if (url.hostname === 'photon.komoot.io') {
      expect(url.pathname).toBe('/reverse');
      expect(url.searchParams.has('lang')).toBe(false);
      return Response.json({ features });
    }
    throw Error('Unexpected paid provider');
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};
describe('postcode settlement independent of address autocomplete', () => {
  it('fills Erith from postcode-centroid matches even when no street/premise data is present', async () => {
    mockProviders([feature()]);
    const result = await (await call()).json();
    expect(result.town).toBe('Erith');
    expect(result.area).toContain('Bexley');
  });
  it.each([
    [feature('DA8 1QD')],
    [feature('DA8 1NY', 'London Borough of Bexley')],
    [feature('DA8 1NY', 'Erith', 'US')],
    [feature('DA8 1NY', 'Erith'), feature('DA8 1NY', 'Another Town')],
  ])('never guesses from neighbouring postcodes, councils, other countries or conflicting towns', async (...features) => {
    mockProviders(features);
    expect((await (await call()).json()).town).toBeNull();
  });
  it('does not add reverse requests to existing area-only callers', async () => {
    const fetcher = mockProviders([feature()]);
    const result = await (await call('q=DA81NY')).json();
    expect(result).not.toHaveProperty('town');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('reuses successful town results without repeated Photon calls', async () => {
    const fetcher = mockProviders([feature()]);
    await call(); await call();
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('photon.komoot.io'))).toHaveLength(1);
  });
});
