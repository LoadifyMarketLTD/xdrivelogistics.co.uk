import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  getBearerToken: () => 'test-token',
  supabaseValidator: { auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) } },
}));
import { GET } from '../app/api/location/postcode-addresses/route';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('postcode-only native settlement lookup', () => {
  it('returns Erith rather than its English administrative borough without choosing an address', async () => {
    vi.stubEnv('ADDRESS_LOOKUP_PAID_FALLBACK_ENABLED', 'false');
    const reverseQueries: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
      if (url.hostname !== 'photon.komoot.io') throw Error('Unexpected paid or external provider');
      if (url.pathname.startsWith('/reverse')) {
        reverseQueries.push(url);
        return Response.json({ features: [{ properties: {
          countrycode: 'GB', street: 'Sandcliff Road', housenumber: '12',
          city: url.searchParams.has('lang') ? 'London Borough of Bexley' : 'Erith',
          postcode: 'DA8 1NY',
        } }] });
      }
      return Response.json({ features: [{
        properties: { countrycode: 'GB', name: 'DA8 1NY', type: 'postcode' },
        geometry: { coordinates: [0.169727, 51.48417] },
      }] });
    }));
    const response = await GET(new NextRequest('https://example.test/api/location/postcode-addresses?postcode=DA81NY'));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.postcodeFound).toBe(true);
    expect(result.suggestions).toEqual(['12 Sandcliff Road, Erith, DA8 1NY, GB']);
    expect(reverseQueries).toHaveLength(1);
    expect(reverseQueries[0].searchParams.has('lang')).toBe(false);
  });
});
