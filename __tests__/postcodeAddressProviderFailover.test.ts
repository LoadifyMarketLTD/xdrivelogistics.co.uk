import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  getBearerToken: () => 'test-token',
  supabaseValidator: {
    auth: {
      getUser: async () => ({ data: { user: { id: 'address-test-user' } }, error: null }),
    },
  },
}));

import { GET } from '../app/api/location/postcode-addresses/route';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const request = (search: string) => new NextRequest(
  `https://www.xdrivelogistics.co.uk/api/location/postcode-addresses?${search}`,
  { headers: { Authorization: 'Bearer test-token' } },
);

describe('postcode address provider failover', () => {
  it('uses GetAddress when Ideal Postcodes refuses an exact postcode lookup', async () => {
    vi.stubEnv('IDEAL_POSTCODES_API_KEY', 'ak_test');
    vi.stubEnv('GETADDRESS_API_KEY', 'getaddress_test');
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('ADDRESS_LOOKUP_PAID_FALLBACK_ENABLED', 'true');

    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
      calls.push(url.hostname);
      if (url.hostname === 'api.ideal-postcodes.co.uk') {
        return new Response(JSON.stringify({ code: 4020, message: 'Insufficient balance' }), { status: 402 });
      }
      if (url.hostname === 'api.getaddress.io') {
        return new Response(JSON.stringify({
          addresses: [{
            line_1: '10 Downing Street',
            town_or_city: 'London',
            county: 'Greater London',
          }],
        }), { status: 200 });
      }
      throw new Error(`Unexpected provider request: ${url.hostname}`);
    }));

    const req = request('postcode=SW1A%202AA');
    expect(req.nextUrl.searchParams.get('postcode')).toBe('SW1A 2AA');
    const response = await GET(req);
    const payload = await response.json();

    expect(calls).toEqual(['api.ideal-postcodes.co.uk', 'api.getaddress.io']);
    expect(response.status).toBe(200);
    expect(payload.provider).toBe('getaddress');
    expect(payload.postcodeFound).toBe(true);
    expect(payload.suggestions).toEqual(['10 Downing Street, London, Greater London']);
    expect(payload.towns).toEqual({ '10 Downing Street, London, Greater London': 'London' });
  });

  it('routes a full postcode query through the exact-postcode fallback for global forms', async () => {
    vi.stubEnv('IDEAL_POSTCODES_API_KEY', 'ak_test');
    vi.stubEnv('GETADDRESS_API_KEY', 'getaddress_test');
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('ADDRESS_LOOKUP_PAID_FALLBACK_ENABLED', 'true');

    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
      calls.push(url.hostname);
      if (url.hostname === 'api.ideal-postcodes.co.uk') {
        return new Response(JSON.stringify({ code: 4020, message: 'Insufficient balance' }), { status: 402 });
      }
      if (url.hostname === 'api.getaddress.io') {
        return new Response(JSON.stringify({
          addresses: [{ line_1: '1 Parliament Street', town_or_city: 'London' }],
        }), { status: 200 });
      }
      throw new Error(`Unexpected provider request: ${url.hostname}`);
    }));

    const response = await GET(request('q=SW1A%202AA'));
    const payload = await response.json();

    expect(calls).toEqual(['api.ideal-postcodes.co.uk', 'api.getaddress.io']);
    expect(payload.provider).toBe('getaddress');
    expect(payload.suggestions).toEqual(['1 Parliament Street, London']);
  });

  it('serves partial postcode suggestions from Photon before any paid provider', async () => {
    vi.stubEnv('IDEAL_POSTCODES_API_KEY', 'ak_test');
    vi.stubEnv('GETADDRESS_API_KEY', 'getaddress_test');
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', 'mapbox_test');

    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
      calls.push(url.hostname);
      if (url.hostname !== 'photon.komoot.io') {
        throw new Error(`Unexpected provider request: ${url.hostname}`);
      }
      return new Response(JSON.stringify({
        features: [{
          properties: {
            countrycode: 'GB',
            street: 'Cornelian Street',
            city: 'Blackburn',
            postcode: 'BB1 9QL',
            type: 'street',
          },
        }],
      }), { status: 200 });
    }));

    const response = await GET(request('q=BB1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.provider).toBe('photon-openstreetmap');
    expect(payload.suggestions).toEqual(['Cornelian Street, Blackburn, BB1 9QL, GB']);
    expect(calls).toEqual(['photon.komoot.io']);
  });

  it('offers valid full postcodes for partial postcode input when Photon has no GB matches', async () => {
    vi.stubEnv('IDEAL_POSTCODES_API_KEY', 'ak_test');
    vi.stubEnv('GETADDRESS_API_KEY', 'getaddress_test');
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', 'mapbox_test');
    vi.stubEnv('ADDRESS_LOOKUP_PAID_FALLBACK_ENABLED', 'false');

    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
      calls.push(url.hostname);
      if (url.hostname === 'photon.komoot.io') return new Response(JSON.stringify({ features: [] }), { status: 200 });
      if (url.hostname === 'api.postcodes.io') return new Response(JSON.stringify({ result: [
        { postcode: 'BB1 9QL' }, { postcode: 'BB10 1AA' },
      ] }), { status: 200 });
      throw new Error(`Unexpected provider request: ${url.hostname}`);
    }));

    const response = await GET(request('q=BB1%209Q'));
    const payload = await response.json();

    expect(payload.provider).toBe('postcodes-io');
    expect(payload.postcodeSuggestions).toBe(true);
    expect(payload.suggestions).toEqual(['BB1 9QL']);
    expect(calls).toEqual(['photon.komoot.io', 'api.postcodes.io']);
  });

  it('uses free Photon address points first and does not spend configured paid-provider credits by default', async () => {
    vi.stubEnv('IDEAL_POSTCODES_API_KEY', 'ak_test');
    vi.stubEnv('GETADDRESS_API_KEY', 'getaddress_test');
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', 'mapbox_test');
    vi.stubEnv('ADDRESS_LOOKUP_PAID_FALLBACK_ENABLED', 'false');

    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
      calls.push(url.hostname);
      if (url.hostname !== 'photon.komoot.io') throw new Error(`Unexpected provider request: ${url.hostname}`);
      return new Response(JSON.stringify({ features: [{ properties: {
        countrycode: 'GB', street: 'Downing Street', housenumber: '10',
        city: 'London', postcode: 'SW1A 2AA', type: 'house',
      } }] }), { status: 200 });
    }));

    const response = await GET(request('postcode=SW1A%202AA'));
    const payload = await response.json();

    expect(payload.provider).toBe('photon-openstreetmap');
    expect(payload.suggestions).toEqual(['10 Downing Street, London, SW1A 2AA, GB']);
    expect(calls).toEqual(['photon.komoot.io']);
  });

  it('confirms an exact postcode through the free postcode dataset when OSM has no address rows', async () => {
    vi.stubEnv('IDEAL_POSTCODES_API_KEY', 'ak_test');
    vi.stubEnv('GETADDRESS_API_KEY', 'getaddress_test');
    vi.stubEnv('ADDRESS_LOOKUP_PAID_FALLBACK_ENABLED', 'false');

    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
      calls.push(url.hostname);
      if (url.hostname === 'photon.komoot.io') return new Response(JSON.stringify({ features: [] }), { status: 200 });
      if (url.hostname === 'api.postcodes.io') return new Response(JSON.stringify({ result: { postcode: 'SW1A 2AA' } }), { status: 200 });
      throw new Error(`Unexpected provider request: ${url.hostname}`);
    }));

    const response = await GET(request('postcode=SW1A%202AA'));
    const payload = await response.json();

    expect(payload.provider).toBe('postcodes-io');
    expect(payload.postcodeFound).toBe(true);
    expect(payload.suggestions).toEqual([]);
    expect(calls).toEqual(['photon.komoot.io', 'api.postcodes.io']);
  });
});
