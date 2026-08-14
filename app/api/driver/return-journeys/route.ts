import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';
import { isDriverContext, requireDriver, respond } from '../mobile/_lib';

type JourneyRow = {
  id: string;
  company_id: string;
  driver_id: string | null;
  vehicle_type: string | null;
  from_postcode: string | null;
  to_postcode: string | null;
  available_from: string | null;
  available_to: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
};

type Coordinates = { lat: number; lng: number };
type JourneyMeta = {
  notes: string;
  journeyKind: 'ad_hoc' | 'regular';
  viaLocations: string[];
  bodyType: string;
  weightKg: number | null;
  spaceUnits: number | null;
};
type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const BASE_SELECT = 'id,company_id,driver_id,vehicle_type,from_postcode,to_postcode,available_from,available_to,notes,status,created_at';
const META_SOURCE = 'xdrive_return_exchange_v2';
const PAGE_SIZES = new Set([5, 10, 25, 50]);
const RADIUS_VALUES = new Set([10, 30, 50, 100, 200, 300]);

function cleanText(value: unknown, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function finiteNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isReturnJourneySchemaUnavailable(error: DatabaseErrorLike | null | undefined) {
  if (!error) return false;
  const code = String(error.code ?? '').toUpperCase();
  const message = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase();
  const missingSchemaCode = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code);
  const mentionsReturnJourneys = message.includes('return_journeys') || message.includes('return journeys');
  return missingSchemaCode && (mentionsReturnJourneys || code === '42P01' || code === 'PGRST205');
}

function returnJourneySchemaUnavailableResponse() {
  return respond(503, {
    error: 'Return Journeys is not enabled in this database build yet.',
    code: 'RETURN_JOURNEYS_SCHEMA_UNAVAILABLE',
  });
}

function decodeNotes(value: string | null): JourneyMeta {
  const fallback: JourneyMeta = {
    notes: value ?? '', journeyKind: 'ad_hoc', viaLocations: [], bodyType: '', weightKg: null, spaceUnits: null,
  };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.source !== META_SOURCE) return fallback;
    return {
      notes: cleanText(parsed.notes),
      journeyKind: parsed.journeyKind === 'regular' ? 'regular' : 'ad_hoc',
      viaLocations: Array.isArray(parsed.viaLocations) ? parsed.viaLocations.map((item) => cleanText(item, 160)).filter(Boolean).slice(0, 8) : [],
      bodyType: cleanText(parsed.bodyType, 100),
      weightKg: finiteNumber(parsed.weightKg),
      spaceUnits: finiteNumber(parsed.spaceUnits),
    };
  } catch {
    return fallback;
  }
}

function encodeNotes(meta: JourneyMeta) {
  return JSON.stringify({ source: META_SOURCE, ...meta });
}

function postcodeKey(value: unknown) {
  return cleanText(value, 32).replace(/\s+/g, '').toUpperCase();
}

function looksLikeUkPostcode(value: string) {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value.trim());
}

async function postcodeCoordinates(postcodes: unknown[]) {
  const unique = [...new Set(postcodes.map(postcodeKey).filter(Boolean))];
  const result = new Map<string, Coordinates>();
  for (let offset = 0; offset < unique.length; offset += 100) {
    const batch = unique.slice(offset, offset + 100);
    try {
      const response = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: batch }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) continue;
      const payload = await response.json() as { result?: Array<{ query?: string; result?: { latitude?: number; longitude?: number } | null }> };
      for (const item of payload.result ?? []) {
        const lat = Number(item.result?.latitude);
        const lng = Number(item.result?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) result.set(postcodeKey(item.query), { lat, lng });
      }
    } catch {
      // Geocoding is best-effort. Text search still works if the service is unavailable.
    }
  }
  return result;
}

async function searchLocationCoordinates(value: string, postcodeMap: Map<string, Coordinates>) {
  if (!value) return null;
  const postcode = postcodeMap.get(postcodeKey(value));
  if (postcode) return postcode;
  if (looksLikeUkPostcode(value)) return null;
  try {
    const query = new URLSearchParams({ format: 'jsonv2', q: `${value}, United Kingdom`, countrycodes: 'gb', limit: '1' });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, {
      headers: { 'User-Agent': 'XDrive Logistics return-journey search' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as Array<{ lat?: string; lon?: string }>;
    const lat = Number(payload[0]?.lat);
    const lng = Number(payload[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

function distanceMiles(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthMiles = 3958.8;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function rangeForDateFilter(value: string) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!value || value === 'anytime') return null;
  if (value === 'today10') return { from: startToday.getTime(), to: startToday.getTime() + 11 * 86_400_000 };
  if (value === 'today') return { from: startToday.getTime(), to: startToday.getTime() + 86_400_000 };
  if (value === 'tomorrow') return { from: startToday.getTime() + 86_400_000, to: startToday.getTime() + 2 * 86_400_000 };
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return { from: parsed.getTime(), to: parsed.getTime() + 86_400_000 };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({ status: 503, message: 'Return Journeys is temporarily unavailable.', context: 'driver.return-journeys.config', retryable: true });
  }
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') === 'mine' ? 'mine' : 'marketplace';
  const fromSearch = cleanText(searchParams.get('from'), 120);
  const toSearch = cleanText(searchParams.get('to'), 120);
  const memberSearch = cleanText(searchParams.get('member'), 120).toLowerCase();
  const vehicleType = cleanText(searchParams.get('vehicle_type'), 100);
  const kind = searchParams.get('kind') === 'regular' ? 'regular' : searchParams.get('kind') === 'ad_hoc' ? 'ad_hoc' : 'all';
  const dateFilter = cleanText(searchParams.get('date'), 20) || 'today10';
  const fromRadiusCandidate = Number(searchParams.get('from_radius') ?? 30);
  const toRadiusCandidate = Number(searchParams.get('to_radius') ?? 100);
  const fromRadius = RADIUS_VALUES.has(fromRadiusCandidate) ? fromRadiusCandidate : 30;
  const toRadius = RADIUS_VALUES.has(toRadiusCandidate) ? toRadiusCandidate : 100;
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const pageSizeCandidate = Number(searchParams.get('page_size') ?? 25) || 25;
  const pageSize = PAGE_SIZES.has(pageSizeCandidate) ? pageSizeCandidate : 25;

  let query = supabaseAdmin.from('return_journeys').select(BASE_SELECT).order('available_from', { ascending: true, nullsFirst: false }).limit(500);
  if (scope === 'mine') {
    query = query.eq('driver_id', driver.driverId);
  } else {
    query = query.in('status', ['active', 'available']);
    if (driver.companyId) query = query.neq('company_id', driver.companyId);
  }
  if (vehicleType) query = query.eq('vehicle_type', vehicleType);

  const { data, error } = await query;
  if (error) {
    if (isReturnJourneySchemaUnavailable(error)) return returnJourneySchemaUnavailableResponse();
    return operationalError({ message: 'Return journeys could not be loaded. Please retry.', context: `driver.return-journeys.get:${scope}`, cause: error });
  }
  const rows = (data ?? []) as JourneyRow[];

  const companyIds = [...new Set(rows.map((row) => row.company_id).filter(Boolean))];
  const driverIds = [...new Set(rows.map((row) => row.driver_id).filter((value): value is string => Boolean(value)))];
  const [companiesResult, driversResult] = await Promise.all([
    companyIds.length ? supabaseAdmin.from('companies').select('id,name,company_number,phone').in('id', companyIds) : Promise.resolve({ data: [], error: null }),
    driverIds.length ? supabaseAdmin.from('drivers').select('id,display_name,phone').in('id', driverIds) : Promise.resolve({ data: [], error: null }),
  ]);

  const companyMap = new Map((companiesResult.data ?? []).map((company: Record<string, unknown>) => [String(company.id), company]));
  const driverMap = new Map((driversResult.data ?? []).map((person: Record<string, unknown>) => [String(person.id), person]));
  const postcodeMap = await postcodeCoordinates([
    fromSearch, toSearch,
    ...rows.flatMap((row) => [row.from_postcode, row.to_postcode]),
  ]);
  const [fromOrigin, toOrigin] = await Promise.all([
    searchLocationCoordinates(fromSearch, postcodeMap),
    searchLocationCoordinates(toSearch, postcodeMap),
  ]);
  const dateRange = rangeForDateFilter(dateFilter);

  const mapped = rows.map((row) => {
    const meta = decodeNotes(row.notes);
    const company = companyMap.get(row.company_id) ?? {};
    const person = row.driver_id ? driverMap.get(row.driver_id) ?? {} : {};
    const fromCoordinates = postcodeMap.get(postcodeKey(row.from_postcode)) ?? null;
    const toCoordinates = postcodeMap.get(postcodeKey(row.to_postcode)) ?? null;
    const journeyDistanceMiles = fromCoordinates && toCoordinates ? distanceMiles(fromCoordinates, toCoordinates) : null;
    return {
      id: row.id,
      companyId: row.company_id,
      driverId: row.driver_id,
      from: row.from_postcode ?? '',
      to: row.to_postcode ?? '',
      availableFrom: row.available_from,
      availableTo: row.available_to,
      vehicleType: row.vehicle_type,
      notes: meta.notes,
      journeyKind: meta.journeyKind,
      viaLocations: meta.viaLocations,
      bodyType: meta.bodyType,
      weightKg: meta.weightKg,
      spaceUnits: meta.spaceUnits,
      goAnywhere: !row.to_postcode,
      status: row.status ?? 'active',
      createdAt: row.created_at,
      member: {
        name: cleanText(company.name, 160) || 'Exchange member',
        code: cleanText(company.company_number, 80) || null,
        phone: cleanText(company.phone, 80) || cleanText(person.phone, 80) || null,
      },
      driverName: cleanText(person.display_name, 160) || null,
      fromCoordinates,
      toCoordinates,
      journeyDistanceMiles: journeyDistanceMiles == null ? null : Math.round(journeyDistanceMiles * 10) / 10,
      fromSearchDistanceMiles: fromOrigin && fromCoordinates ? distanceMiles(fromOrigin, fromCoordinates) : null,
      toSearchDistanceMiles: toOrigin && toCoordinates ? distanceMiles(toOrigin, toCoordinates) : null,
    };
  }).filter((journey) => {
    if (kind !== 'all' && journey.journeyKind !== kind) return false;
    if (memberSearch) {
      const memberHaystack = `${journey.member.name} ${journey.member.code ?? ''} ${journey.driverName ?? ''}`.toLowerCase();
      if (!memberHaystack.includes(memberSearch)) return false;
    }
    if (dateRange && journey.availableFrom) {
      const when = new Date(journey.availableFrom).getTime();
      if (Number.isFinite(when) && (when < dateRange.from || when >= dateRange.to)) return false;
    }
    if (scope === 'marketplace' && journey.availableTo) {
      const availableTo = new Date(journey.availableTo).getTime();
      if (Number.isFinite(availableTo) && availableTo < Date.now()) return false;
    }
    if (fromSearch) {
      if (fromOrigin && journey.fromCoordinates) {
        if ((journey.fromSearchDistanceMiles ?? Number.POSITIVE_INFINITY) > fromRadius) return false;
      } else if (!journey.from.toLowerCase().includes(fromSearch.toLowerCase())) return false;
    }
    if (toSearch && !journey.goAnywhere) {
      if (toOrigin && journey.toCoordinates) {
        if ((journey.toSearchDistanceMiles ?? Number.POSITIVE_INFINITY) > toRadius) return false;
      } else if (!journey.to.toLowerCase().includes(toSearch.toLowerCase())) return false;
    }
    return true;
  });

  if (scope === 'mine') {
    mapped.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }
  const total = mapped.length;
  const start = (page - 1) * pageSize;
  const journeys = mapped.slice(start, start + pageSize);

  return respond(200, {
    journeys,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    generatedAt: new Date().toISOString(),
    partialMemberData: Boolean(companiesResult.error || driversResult.error),
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({ status: 503, message: 'Return Journeys is temporarily unavailable.', context: 'driver.return-journeys.config', retryable: true });
  }
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  if (!driver.companyId) return respond(400, { error: 'A company context is required to publish exchange journeys.' });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const fromPostcode = cleanText(body.from, 120);
  const toPostcode = cleanText(body.to, 120);
  if (!fromPostcode) return respond(400, { error: 'Starting location is required.' });
  const availableFrom = cleanText(body.availableFrom, 80);
  const availableTo = cleanText(body.availableTo, 80);
  if (availableFrom && Number.isNaN(new Date(availableFrom).getTime())) return respond(400, { error: 'Departure date/time is invalid.' });
  if (availableTo && Number.isNaN(new Date(availableTo).getTime())) return respond(400, { error: 'ETA / available-until date/time is invalid.' });

  const meta: JourneyMeta = {
    notes: cleanText(body.notes, 3000),
    journeyKind: body.journeyKind === 'regular' ? 'regular' : 'ad_hoc',
    viaLocations: Array.isArray(body.viaLocations) ? body.viaLocations.map((item) => cleanText(item, 160)).filter(Boolean).slice(0, 8) : [],
    bodyType: cleanText(body.bodyType, 100),
    weightKg: finiteNumber(body.weightKg),
    spaceUnits: finiteNumber(body.spaceUnits),
  };

  const insert = {
    company_id: driver.companyId,
    driver_id: driver.driverId,
    vehicle_type: cleanText(body.vehicleType, 100) || null,
    from_postcode: fromPostcode,
    to_postcode: body.goAnywhere === true ? null : (toPostcode || null),
    available_from: availableFrom || null,
    available_to: availableTo || null,
    notes: encodeNotes(meta),
    status: 'available',
  };
  const { data, error } = await supabaseAdmin.from('return_journeys').insert(insert).select(BASE_SELECT).maybeSingle();
  if (error) {
    if (isReturnJourneySchemaUnavailable(error)) return returnJourneySchemaUnavailableResponse();
    return operationalError({ message: 'The return journey could not be published. Please retry.', context: `driver.return-journeys.post:${driver.driverId}`, cause: error });
  }
  return respond(201, { journey: data });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({ status: 503, message: 'Return Journeys is temporarily unavailable.', context: 'driver.return-journeys.config', retryable: true });
  }
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  const id = cleanText(new URL(request.url).searchParams.get('id'), 80);
  if (!id) return respond(400, { error: 'Journey id is required.' });
  const { data, error } = await supabaseAdmin
    .from('return_journeys')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('driver_id', driver.driverId)
    .select('id,status')
    .maybeSingle();
  if (error) {
    if (isReturnJourneySchemaUnavailable(error)) return returnJourneySchemaUnavailableResponse();
    return operationalError({ message: 'The return journey could not be cancelled. Please retry.', context: `driver.return-journeys.delete:${id}`, cause: error });
  }
  if (!data) return respond(404, { error: 'Journey not found.' });
  return respond(200, { journey: data });
}
