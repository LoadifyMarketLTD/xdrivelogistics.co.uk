import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
} as const;

const IDEAL_REQUEST_HEADERS = {
  Origin: 'https://www.xdrivelogistics.co.uk',
  Referer: 'https://www.xdrivelogistics.co.uk/',
  'User-Agent': 'XDriveLogistics/1.0 address-lookup',
} as const;

const normalizePostcode = (value: string) => {
  const compact = value.toUpperCase().replace(/\s+/g, '').trim();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};

const isFullUkPostcode = (value: string) => /^(GIR 0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{1,2}) \d[A-Z]{2})$/i.test(normalizePostcode(value));

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const dedupe = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase('en-GB');
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatAddress = (parts: unknown[]) => dedupe(
  parts.map(clean).filter(Boolean),
).join(', ');

type IdealAutocompleteHit = {
  suggestion?: string | null;
};

type IdealAddress = {
  line_1?: string | null;
  line_2?: string | null;
  line_3?: string | null;
  dependant_locality?: string | null;
  post_town?: string | null;
  county?: string | null;
  postcode?: string | null;
};

type GetAddressAddress = {
  line_1?: string | null;
  line_2?: string | null;
  line_3?: string | null;
  line_4?: string | null;
  locality?: string | null;
  town_or_city?: string | null;
  county?: string | null;
};


type GetAddressAutocompleteSuggestion = {
  address?: string | null;
  location?: string | null;
};

async function lookupGetAddressAutocomplete(query: string, apiKey: string) {
  const endpoints = [
    new URL(`https://api.getAddress.io/autocomplete/${encodeURIComponent(query)}`),
    new URL(`https://api.getAddress.io/location/${encodeURIComponent(query)}`),
  ];

  for (const url of endpoints) {
    url.searchParams.set('api-key', apiKey);
    url.searchParams.set('top', '12');
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(6_000),
        cache: 'no-store',
      });
      if (!response.ok) continue;
      const payload = await response.json() as { suggestions?: GetAddressAutocompleteSuggestion[] };
      const suggestions = Array.isArray(payload.suggestions)
        ? dedupe(payload.suggestions
          .map((item) => clean(item.address) || clean(item.location))
          .filter(Boolean))
        : [];
      if (suggestions.length) return suggestions;
    } catch {
      // Try the next provider shape.
    }
  }
  return [] as string[];
}


type PhotonFeature = {
  properties?: {
    countrycode?: string | null;
    name?: string | null;
    street?: string | null;
    city?: string | null;
    district?: string | null;
    postcode?: string | null;
    type?: string | null;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

const PHOTON_HEADERS = {
  'User-Agent': 'XDriveLogistics/1.0 address-autocomplete',
} as const;

const postcodeFragment = (value: string) => value.toUpperCase().replace(/\s+/g, '');

async function photonFeatures(url: URL) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(7_000),
      cache: 'no-store',
      headers: PHOTON_HEADERS,
    });
    if (!response.ok) return [] as PhotonFeature[];
    const payload = await response.json() as { features?: PhotonFeature[] };
    return Array.isArray(payload.features) ? payload.features : [];
  } catch {
    return [] as PhotonFeature[];
  }
}

function photonAddressLabel(feature: PhotonFeature, requiredPostcodePrefix = '') {
  const props = feature.properties ?? {};
  if (clean(props.countrycode).toUpperCase() !== 'GB') return '';
  const postcode = clean(props.postcode);
  if (requiredPostcodePrefix && postcode && !postcodeFragment(postcode).startsWith(requiredPostcodePrefix)) return '';
  const street = clean(props.street)
    || (clean(props.type).toLowerCase() === 'street' ? clean(props.name) : '');
  if (!street) return '';
  const locality = clean(props.city) || clean(props.district);
  return formatAddress([street, locality, postcode, 'GB']);
}

async function lookupPhotonAutocomplete(query: string) {
  const trimmed = clean(query);
  if (trimmed.length < 3) return [] as string[];

  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', '12');
  url.searchParams.set('lang', 'en');
  let forward = await photonFeatures(url);
  const postcodeQuery = postcodeFragment(trimmed);
  const looksLikePostcode = /^[A-Z]{1,2}\d[A-Z\d]?\d?[A-Z]{0,2}$/.test(postcodeQuery);

  if (looksLikePostcode && /^[A-Z]{2}\d{2}$/.test(postcodeQuery)) {
    const hasMatchingGbPostcode = forward.some((feature) => {
      const props = feature.properties ?? {};
      const candidate = postcodeFragment(clean(props.name) || clean(props.postcode));
      return clean(props.countrycode).toUpperCase() === 'GB' && candidate.startsWith(postcodeQuery);
    });
    if (!hasMatchingGbPostcode) {
      const alternate = new URL('https://photon.komoot.io/api/');
      alternate.searchParams.set('q', `${postcodeQuery.slice(0, -1)} ${postcodeQuery.slice(-1)}`);
      alternate.searchParams.set('limit', '12');
      alternate.searchParams.set('lang', 'en');
      forward = [...forward, ...await photonFeatures(alternate)];
    }
  }

  if (looksLikePostcode && postcodeQuery.length >= 4) {
    const postcodeFeatures = forward.filter((feature) => {
      const props = feature.properties ?? {};
      if (clean(props.countrycode).toUpperCase() !== 'GB') return false;
      const candidate = postcodeFragment(clean(props.name) || clean(props.postcode));
      return candidate.startsWith(postcodeQuery);
    }).slice(0, 8);

    const reverseRows = await Promise.all(postcodeFeatures.map(async (feature) => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length < 2) return [] as PhotonFeature[];
      const reverse = new URL('https://photon.komoot.io/reverse');
      reverse.searchParams.set('lon', String(coordinates[0]));
      reverse.searchParams.set('lat', String(coordinates[1]));
      reverse.searchParams.set('limit', '5');
      reverse.searchParams.set('lang', 'en');
      return photonFeatures(reverse);
    }));

    const postcodeSuggestions = dedupe(
      reverseRows.flat()
        .map((feature) => photonAddressLabel(feature, postcodeQuery))
        .filter(Boolean),
    );
    if (postcodeSuggestions.length) return postcodeSuggestions.slice(0, 12);
  }

  return dedupe(
    forward.map((feature) => photonAddressLabel(feature)).filter(Boolean),
  ).slice(0, 12);
}

type MapboxFeature = {
  properties?: {
    full_address?: string | null;
    name?: string | null;
    name_preferred?: string | null;
    place_formatted?: string | null;
  };
};

async function lookupMapboxAutocomplete(query: string, accessToken: string) {
  if (query.trim().length < 3) return [] as string[];

  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('country', 'gb');
  url.searchParams.set('language', 'en');
  url.searchParams.set('autocomplete', 'true');
  url.searchParams.set('types', 'address,street,postcode,place,locality');
  url.searchParams.set('limit', '10');

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
    });
    if (!response.ok) return [] as string[];
    const payload = await response.json() as { features?: MapboxFeature[] };
    const features = Array.isArray(payload.features) ? payload.features : [];
    return dedupe(features.map((feature) => {
      const props = feature.properties ?? {};
      return clean(props.full_address)
        || formatAddress([props.name_preferred || props.name, props.place_formatted]);
    }).filter(Boolean));
  } catch {
    return [] as string[];
  }
}

async function lookupIdealAutocomplete(query: string, apiKey: string) {
  const url = new URL('https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('context', 'GBR');
  url.searchParams.set('limit', '12');

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
      headers: IDEAL_REQUEST_HEADERS,
    });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: { hits?: IdealAutocompleteHit[] } };
    const hits = Array.isArray(payload.result?.hits) ? payload.result?.hits : [];
    return dedupe(hits.map((hit) => clean(hit.suggestion)).filter(Boolean));
  } catch {
    return null;
  }
}

async function lookupIdealPostcodes(postcode: string, apiKey: string) {
  const url = new URL(`https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}`);
  url.searchParams.set('api_key', apiKey);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
      headers: IDEAL_REQUEST_HEADERS,
    });
    if (response.status === 404) return { suggestions: [] as string[], notFound: true };
    if (!response.ok) return null;

    const payload = await response.json() as { result?: IdealAddress[] };
    const rows = Array.isArray(payload.result) ? payload.result : [];
    return {
      suggestions: dedupe(rows.map((row) => formatAddress([
        row.line_1,
        row.line_2,
        row.line_3,
        row.dependant_locality,
        row.post_town,
        row.county,
      ])).filter(Boolean)),
      notFound: false,
    };
  } catch {
    return null;
  }
}

async function lookupGetAddress(postcode: string, apiKey: string) {
  const url = new URL(`https://api.getAddress.io/find/${encodeURIComponent(postcode)}`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('expand', 'true');

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
    });
    if (response.status === 404) return { suggestions: [] as string[], notFound: true };
    if (!response.ok) return null;

    const payload = await response.json() as { addresses?: GetAddressAddress[] };
    const rows = Array.isArray(payload.addresses) ? payload.addresses : [];
    return {
      suggestions: dedupe(rows.map((row) => formatAddress([
        row.line_1,
        row.line_2,
        row.line_3,
        row.line_4,
        row.locality,
        row.town_or_city,
        row.county,
      ])).filter(Boolean)),
      notFound: false,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!supabaseValidator) {
    return NextResponse.json({ error: 'Address lookup is temporarily unavailable.' }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });
  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });

  const rawQuery = clean(request.nextUrl.searchParams.get('q') ?? '');
  const postcode = normalizePostcode(request.nextUrl.searchParams.get('postcode') ?? '');
  const autocompleteQuery = rawQuery || postcode;
  const exactPostcode = isFullUkPostcode(postcode);

  if (!autocompleteQuery || autocompleteQuery.length < 2) {
    return NextResponse.json({ error: 'Enter at least 2 characters.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const idealKey = process.env.IDEAL_POSTCODES_API_KEY?.trim();
  const getAddressKey = process.env.GETADDRESS_API_KEY?.trim();
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN?.trim();

  if (idealKey && !exactPostcode) {
    const suggestions = await lookupIdealAutocomplete(autocompleteQuery, idealKey);
    if (suggestions?.length) {
      return NextResponse.json({
        suggestions,
        configured: true,
        provider: 'ideal-postcodes-autocomplete',
      }, { headers: NO_STORE_HEADERS });
    }
  }

  if (getAddressKey && !exactPostcode) {
    const suggestions = await lookupGetAddressAutocomplete(autocompleteQuery, getAddressKey);
    if (suggestions.length) {
      return NextResponse.json({
        suggestions,
        configured: true,
        provider: 'getaddress-autocomplete',
      }, { headers: NO_STORE_HEADERS });
    }
  }

  if (mapboxToken && !exactPostcode) {
    const suggestions = await lookupMapboxAutocomplete(autocompleteQuery, mapboxToken);
    if (suggestions.length) {
      return NextResponse.json({
        suggestions,
        configured: true,
        provider: 'mapbox-geocoding-autocomplete',
      }, { headers: NO_STORE_HEADERS });
    }
  }

  if (!exactPostcode) {
    const suggestions = await lookupPhotonAutocomplete(autocompleteQuery);
    if (suggestions.length) {
      return NextResponse.json({
        suggestions,
        configured: true,
        provider: 'photon-openstreetmap',
      }, { headers: NO_STORE_HEADERS });
    }
  }

  if (idealKey && exactPostcode) {
    const result = await lookupIdealPostcodes(postcode, idealKey);
    if (result?.suggestions.length) {
      return NextResponse.json({
        suggestions: result.suggestions,
        configured: true,
        provider: 'ideal-postcodes',
        postcodeFound: !result.notFound,
      }, { headers: NO_STORE_HEADERS });
    }
  }

  if (getAddressKey && exactPostcode) {
    const result = await lookupGetAddress(postcode, getAddressKey);
    if (result?.suggestions.length) {
      return NextResponse.json({
        suggestions: result.suggestions,
        configured: true,
        provider: 'getaddress',
        postcodeFound: !result.notFound,
      }, { headers: NO_STORE_HEADERS });
    }
  }

  if (exactPostcode) {
    const suggestions = await lookupPhotonAutocomplete(postcode);
    if (suggestions.length) {
      return NextResponse.json({
        suggestions,
        configured: true,
        provider: 'photon-openstreetmap',
        postcodeFound: true,
      }, { headers: NO_STORE_HEADERS });
    }
  }

  return NextResponse.json({
    suggestions: [],
    configured: true,
    provider: idealKey ? 'ideal-postcodes-autocomplete' : getAddressKey ? 'getaddress' : mapboxToken ? 'mapbox-geocoding-autocomplete' : null,
  }, { headers: NO_STORE_HEADERS });
}
