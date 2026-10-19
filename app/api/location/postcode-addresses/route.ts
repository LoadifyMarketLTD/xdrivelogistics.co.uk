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

async function lookupPublicPostcodeAutocomplete(query: string) {
  const compactQuery = query.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d?[A-Z]{0,2}$/.test(compactQuery)) return [] as string[];

  try {
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(compactQuery)}/autocomplete?limit=12`,
      { signal: AbortSignal.timeout(5_000), cache: 'no-store' },
    );
    if (!response.ok) return [] as string[];
    const payload = await response.json() as { result?: unknown };
    return Array.isArray(payload.result)
      ? dedupe(payload.result.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))
      : [];
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
    return NextResponse.json({ error: 'Address lookup is temporarily unavailable.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const rawQuery = clean(request.nextUrl.searchParams.get('q') ?? '');
  const postcode = normalizePostcode(request.nextUrl.searchParams.get('postcode') ?? '');
  const autocompleteQuery = rawQuery || postcode;
  const exactPostcode = isFullUkPostcode(postcode);

  if (!autocompleteQuery || autocompleteQuery.length < 2) {
    return NextResponse.json({ error: 'Enter at least 2 characters.' }, { status: 400 });
  }

  const idealKey = process.env.IDEAL_POSTCODES_API_KEY?.trim();
  const getAddressKey = process.env.GETADDRESS_API_KEY?.trim();

  if (idealKey && !exactPostcode) {
    const suggestions = await lookupIdealAutocomplete(autocompleteQuery, idealKey);
    if (suggestions?.length) {
      return NextResponse.json({
        suggestions,
        configured: true,
        provider: 'ideal-postcodes-autocomplete',
      }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    }
  }

  if (getAddressKey && !exactPostcode) {
    const suggestions = await lookupGetAddressAutocomplete(autocompleteQuery, getAddressKey);
    if (suggestions.length) {
      return NextResponse.json({
        suggestions,
        configured: true,
        provider: 'getaddress-autocomplete',
      }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    }
  }

  if (!exactPostcode) {
    const suggestions = await lookupPublicPostcodeAutocomplete(autocompleteQuery);
    if (suggestions.length) {
      return NextResponse.json({
        suggestions,
        configured: Boolean(idealKey || getAddressKey),
        provider: 'postcodes-io-autocomplete',
      }, { headers: { 'Cache-Control': 'public, max-age=300' } });
    }
  }

  if (idealKey && exactPostcode) {
    const result = await lookupIdealPostcodes(postcode, idealKey);
    if (result) {
      return NextResponse.json({
        suggestions: result.suggestions,
        configured: true,
        provider: 'ideal-postcodes',
        postcodeFound: !result.notFound,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
  }

  if (getAddressKey && exactPostcode) {
    const result = await lookupGetAddress(postcode, getAddressKey);
    if (result) {
      return NextResponse.json({
        suggestions: result.suggestions,
        configured: true,
        provider: 'getaddress',
        postcodeFound: !result.notFound,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
  }

  return NextResponse.json({
    suggestions: [],
    configured: true,
    provider: idealKey ? 'ideal-postcodes-autocomplete' : getAddressKey ? 'getaddress' : null,
  }, { headers: { 'Cache-Control': 'private, max-age=30' } });
}
