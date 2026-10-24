import { NextRequest, NextResponse } from 'next/server';
import { resolvePostcodeTown } from '../../../../lib/postcodeTown';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normaliseLocation(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  const fullPostcode = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact);
  const outcode = /^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact);
  if (!fullPostcode && !outcode) return null;
  return { compact, kind: fullPostcode ? 'postcode' as const : 'outcode' as const };
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('q') ?? '';
  const location = normaliseLocation(raw);
  if (!location) {
    return NextResponse.json({ error: 'Enter a valid UK postcode or outcode.' }, { status: 400 });
  }

  try {
    const endpoint = location.kind === 'postcode'
      ? `https://api.postcodes.io/postcodes/${encodeURIComponent(location.compact)}`
      : `https://api.postcodes.io/outcodes/${encodeURIComponent(location.compact)}`;
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Postcode or outcode could not be resolved.' }, { status: 404 });
    }
    const payload = await response.json() as {
      result?: {
        admin_district?: string | string[] | null;
        region?: string | null;
        country?: string | null;
        latitude?: number | null;
        longitude?: number | null;
      } | null;
    };
    const district = Array.isArray(payload.result?.admin_district)
      ? payload.result?.admin_district[0]
      : payload.result?.admin_district;
    const parts = [district, payload.result?.region, payload.result?.country]
      .filter((value): value is string => Boolean(value));

    const town = request.nextUrl.searchParams.get('town') === '1' && location.kind === 'postcode'
      ? await resolvePostcodeTown(location.compact, payload.result?.latitude, payload.result?.longitude)
      : null;

    return NextResponse.json({
      ...(request.nextUrl.searchParams.get('town') === '1' ? { town } : {}),
      query: location.compact,
      kind: location.kind,
      area: [...new Set(parts)].join(' · '),
      latitude: Number.isFinite(Number(payload.result?.latitude)) ? Number(payload.result?.latitude) : null,
      longitude: Number.isFinite(Number(payload.result?.longitude)) ? Number(payload.result?.longitude) : null,
    }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Postcode lookup is temporarily unavailable.' }, { status: 503 });
  }
}
