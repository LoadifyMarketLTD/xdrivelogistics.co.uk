import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const normalizePostcode = (value: string) => {
  const compact = value.toUpperCase().replace(/\s+/g, '').trim();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};

const isFullUkPostcode = (value: string) => /^(GIR 0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{1,2}) \d[A-Z]{2})$/i.test(normalizePostcode(value));

const normalizedKey = (value: string) => normalizePostcode(value).replace(/\s/g, '');

const featurePostcode = (feature: Record<string, unknown>) => {
  const properties = feature.properties as Record<string, unknown> | undefined;
  const context = properties?.context as Record<string, unknown> | undefined;
  const postcode = context?.postcode as Record<string, unknown> | undefined;
  return typeof postcode?.name === 'string' ? postcode.name : '';
};

const featureLabel = (feature: Record<string, unknown>) => {
  const properties = feature.properties as Record<string, unknown> | undefined;
  const preferred = properties?.name_preferred;
  const name = properties?.name;
  return typeof preferred === 'string' && preferred.trim()
    ? preferred.trim()
    : typeof name === 'string'
      ? name.trim()
      : '';
};

const dedupe = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase('en-GB');
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mapboxFeatures = async (url: URL) => {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) return [] as Array<Record<string, unknown>>;
    const payload = await response.json() as { features?: Array<Record<string, unknown>> };
    return Array.isArray(payload.features) ? payload.features : [];
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
};

export async function GET(request: NextRequest) {
  if (!supabaseValidator) {
    return NextResponse.json({ error: 'Address lookup is temporarily unavailable.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const postcode = normalizePostcode(request.nextUrl.searchParams.get('postcode') ?? '');
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120);
  if (!isFullUkPostcode(postcode)) {
    return NextResponse.json({ error: 'Enter a full UK postcode.' }, { status: 400 });
  }

  const accessToken = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return NextResponse.json({ suggestions: [], configured: false }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const expectedPostcode = normalizedKey(postcode);
  let features: Array<Record<string, unknown>> = [];

  if (query) {
    const forward = new URL('https://api.mapbox.com/search/geocode/v6/forward');
    forward.searchParams.set('q', `${query}, ${postcode}`);
    forward.searchParams.set('country', 'gb');
    forward.searchParams.set('types', 'address,street');
    forward.searchParams.set('limit', '5');
    forward.searchParams.set('access_token', accessToken);
    features = await mapboxFeatures(forward);
  } else {
    try {
      const postcodeResponse = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
        signal: AbortSignal.timeout(4_000),
        cache: 'no-store',
      });
      if (postcodeResponse.ok) {
        const payload = await postcodeResponse.json() as { result?: { latitude?: number; longitude?: number } | null };
        const latitude = Number(payload.result?.latitude);
        const longitude = Number(payload.result?.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          const reverse = new URL('https://api.mapbox.com/search/geocode/v6/reverse');
          reverse.searchParams.set('latitude', String(latitude));
          reverse.searchParams.set('longitude', String(longitude));
          reverse.searchParams.set('types', 'street');
          reverse.searchParams.set('limit', '10');
          reverse.searchParams.set('access_token', accessToken);
          features = await mapboxFeatures(reverse);
        }
      }
    } catch {
      features = [];
    }
  }

  const exactPostcodeFeatures = features.filter((feature) => {
    const candidate = featurePostcode(feature);
    return Boolean(candidate) && normalizedKey(candidate) === expectedPostcode;
  });
  const suggestions = dedupe(exactPostcodeFeatures.map(featureLabel)).slice(0, 10);

  return NextResponse.json({ suggestions, configured: true }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
