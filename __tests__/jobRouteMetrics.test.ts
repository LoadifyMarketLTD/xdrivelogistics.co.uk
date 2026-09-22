import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateJobRouteMetrics } from '../app/api/_lib/jobRouteMetrics';

const originalMapbox = process.env.MAPBOX_ACCESS_TOKEN;
const originalGoogle = process.env.GOOGLE_MAPS_API_KEY;
const originalPublicGoogle = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

function geocodeResponse() {
  return jsonResponse({
    result: [
      { query: 'BB19QL', result: { latitude: 53.772, longitude: -2.422 } },
      { query: 'LS42AU', result: { latitude: 53.800, longitude: -1.584 } },
    ],
  });
}

describe('calculateJobRouteMetrics provider fallback', () => {
  beforeEach(() => {
    delete process.env.MAPBOX_ACCESS_TOKEN;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalMapbox === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
    else process.env.MAPBOX_ACCESS_TOKEN = originalMapbox;
    if (originalGoogle === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalGoogle;
    if (originalPublicGoogle === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalPublicGoogle;
  });

  it('uses Google Directions when Mapbox is not configured', async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'google-test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geocodeResponse())
      .mockResolvedValueOnce(jsonResponse({
        status: 'OK',
        routes: [{ legs: [{ distance: { value: 100_000 }, duration: { value: 5_400 } }] }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await calculateJobRouteMetrics(['BB1 9QL', 'LS4 2AU']);

    expect(result).toMatchObject({
      source: 'google_directions',
      pickupLat: 53.772,
      deliveryLat: 53.8,
      distanceMiles: 62.1,
      durationMinutes: 90,
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('maps.googleapis.com/maps/api/directions/json');
  });

  it('prefers Mapbox when the Mapbox route succeeds', async () => {
    process.env.MAPBOX_ACCESS_TOKEN = 'mapbox-test-key';
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'google-test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geocodeResponse())
      .mockResolvedValueOnce(jsonResponse({
        routes: [{ distance: 80_000, duration: 4_000 }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await calculateJobRouteMetrics(['BB1 9QL', 'LS4 2AU']);

    expect(result?.source).toBe('mapbox_driving');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('api.mapbox.com/directions');
  });

  it('falls back to Google if Mapbox is configured but unavailable', async () => {
    process.env.MAPBOX_ACCESS_TOKEN = 'mapbox-test-key';
    process.env.GOOGLE_MAPS_API_KEY = 'google-server-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geocodeResponse())
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({
        status: 'OK',
        routes: [{ legs: [{ distance: { value: 60_000 }, duration: { value: 3_600 } }] }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await calculateJobRouteMetrics(['BB1 9QL', 'LS4 2AU']);

    expect(result?.source).toBe('google_directions');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns null rather than fabricating route metrics when no routing provider is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(geocodeResponse()).mockResolvedValueOnce(jsonResponse({}, false));
    vi.stubGlobal('fetch', fetchMock);

    await expect(calculateJobRouteMetrics(['BB1 9QL', 'LS4 2AU'])).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
