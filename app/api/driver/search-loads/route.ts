import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';
import {
  marketplaceNumber,
  marketplaceText,
  proposedPriceAmount,
  publicAreaLabel,
  publicOutcode,
  publicQuoteNotes,
  quoteSafeRequirementFlags,
} from '../_lib/marketplacePublic';
import { isDriverContext, respond } from '../mobile/_lib';
import { requireWebDriver } from '../_lib/webDriver';
import { vehicleMatchesMarketplaceSizeRange } from '../../../../lib/vehicleSizeRange';

type Coordinates = { lat: number; lng: number };
type CompanyRef = {
  name?: string | null;
  company_number?: string | null;
  phone?: string | null;
  company_type?: string | null;
  created_at?: string | null;
} | Array<{
  name?: string | null;
  company_number?: string | null;
  phone?: string | null;
  company_type?: string | null;
  created_at?: string | null;
}> | null;

type SearchLoadRow = Record<string, unknown> & {
  id: string;
  company_id: string | null;
  status: string | null;
  current_status: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_lat: number | string | null;
  pickup_lng: number | string | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_lat: number | string | null;
  delivery_lng: number | string | null;
  delivery_datetime: string | null;
  delivery_time_slot: string | null;
  pickup_country_code: string | null;
  delivery_country_code: string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  pallets: number | null;
  weight_kg: number | string | null;
  budget_amount: number | string | null;
  currency: string | null;
  is_fixed_price: boolean | null;
  load_details: string | null;
  special_requirements: string | null;
  service_mode: string | null;
  direct_delivery_required: boolean | null;
  distance_miles: number | string | null;
  job_distance_miles: number | string | null;
  exchange_posted_at: string | null;
  exchange_expires_at: string | null;
  exchange_visibility: string | null;
  direct_invite_company_id: string | null;
  companies: CompanyRef;
};

// Exact addresses/coordinates and mixed legacy execution fields are selected only
// server-side for authorised radius calculation/classification. They are never
// spread into the response DTO.
const SEARCH_SELECT = [
  'id', 'company_id', 'status', 'current_status',
  'pickup_location', 'pickup_postcode', 'pickup_lat', 'pickup_lng', 'pickup_datetime', 'pickup_time_slot',
  'delivery_location', 'delivery_postcode', 'delivery_lat', 'delivery_lng', 'delivery_datetime', 'delivery_time_slot',
  'pickup_country_code', 'delivery_country_code',
  'vehicle_type', 'requested_vehicle_type', 'requested_vehicle_label',
  'cargo_type', 'requested_cargo_label', 'pallets', 'weight_kg',
  'budget_amount', 'currency', 'is_fixed_price',
  'load_details', 'special_requirements',
  'collection_tail_lift_required', 'collection_forklift_available', 'collection_handball_required',
  'delivery_tail_lift_required', 'delivery_forklift_available', 'delivery_handball_required',
  'service_mode', 'direct_delivery_required', 'distance_miles', 'job_distance_miles', 'exchange_posted_at', 'exchange_expires_at',
  'exchange_visibility', 'direct_invite_company_id',
  'companies!jobs_company_id_fkey(name,company_number,phone,company_type,created_at)',
].join(',');

const RADIUS_VALUES = new Set([10, 20, 30, 50, 100, 200, 300]);
const PAGE_SIZES = new Set([10, 25, 50]);

function validCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng) ? { lat: parsedLat, lng: parsedLng } : null;
}

function postcodeKey(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

function companyInfo(value: CompanyRef) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function exchangePostActive(row: SearchLoadRow, nowMs = Date.now()) {
  if (!row.exchange_expires_at) return true;
  const expires = new Date(row.exchange_expires_at).getTime();
  return Number.isFinite(expires) && expires > nowMs;
}

function distanceMiles(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthMiles = 3958.8;
  const deltaLat = radians(to.lat - from.lat);
  const deltaLng = radians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function postcodeCoordinates(postcodes: unknown[]) {
  const unique = [...new Set(postcodes.map(postcodeKey).filter(Boolean))];
  const result = new Map<string, Coordinates>();
  if (unique.length === 0) return result;

  try {
    const response = await fetch('https://api.postcodes.io/postcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postcodes: unique }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return result;
    const payload = await response.json() as {
      result?: Array<{ query?: string; result?: { latitude?: number; longitude?: number } | null }>;
    };
    for (const item of payload.result ?? []) {
      const coordinates = validCoordinates(item.result?.latitude, item.result?.longitude);
      if (coordinates) result.set(postcodeKey(item.query), coordinates);
    }
  } catch {
    // Best effort only. Private coordinates are used only server-side for radius ranking.
  }

  return result;
}

function postcodeHint(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const full = normalized.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  if (full?.[1]) return { kind: 'postcode' as const, value: full[1].replace(/\s+/g, '') };
  const outcode = normalized.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\b/);
  return outcode?.[1] ? { kind: 'outcode' as const, value: outcode[1] } : null;
}

async function resolveSearchCoordinates(value: string): Promise<Coordinates | null> {
  const hint = postcodeHint(value);
  if (!hint) return null;

  try {
    const endpoint = hint.kind === 'postcode'
      ? `https://api.postcodes.io/postcodes/${encodeURIComponent(hint.value)}`
      : `https://api.postcodes.io/outcodes/${encodeURIComponent(hint.value)}`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: { latitude?: number; longitude?: number } | null };
    return validCoordinates(payload.result?.latitude, payload.result?.longitude);
  } catch {
    return null;
  }
}

function relation(row: SearchLoadRow) {
  if (!row.pickup_datetime || !row.delivery_datetime) return 'unknown';
  const pickup = new Date(row.pickup_datetime);
  const delivery = new Date(row.delivery_datetime);
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(delivery.getTime())) return 'unknown';
  const pickupDay = Date.UTC(pickup.getUTCFullYear(), pickup.getUTCMonth(), pickup.getUTCDate());
  const deliveryDay = Date.UTC(delivery.getUTCFullYear(), delivery.getUTCMonth(), delivery.getUTCDate());
  const days = Math.round((deliveryDay - pickupDay) / 86_400_000);
  return days === 0 ? 'same_day' : days === 1 ? 'next_day' : days >= 2 && days <= 5 ? '3_5_days' : 'other';
}

function timed(row: SearchLoadRow) {
  const slots = [row.pickup_time_slot, row.delivery_time_slot]
    .map((value) => String(value ?? '').trim().toUpperCase())
    .filter(Boolean);
  return slots.some((value) => value !== 'ASAP');
}

function jobDescription(row: SearchLoadRow) {
  if (row.direct_delivery_required) return 'deliver_direct';
  const service = String(row.service_mode ?? '').toLowerCase();
  if (service.includes('multi')) return 'multi_drop';
  const dateRelation = relation(row);
  if (dateRelation === 'same_day') return timed(row) ? 'same_day_timed' : 'same_day_non_timed';
  if (dateRelation === 'next_day') return timed(row) ? 'next_day_timed' : 'next_day_non_timed';
  if (dateRelation === '3_5_days') return '3_5_days';
  return 'other';
}

function loadType(row: SearchLoadRow) {
  const service = String(row.service_mode ?? '').toLowerCase();
  if (service.includes('daily') || service.includes('hire')) return 'daily_hire';
  if (service.includes('regular')) return 'regular_load';
  return 'on_demand';
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'Marketplace search is temporarily unavailable.',
      context: 'driver.search-loads.config',
      retryable: true,
    });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from')?.trim() ?? '';
  const to = searchParams.get('to')?.trim() ?? '';
  const fromRadius = RADIUS_VALUES.has(Number(searchParams.get('fromRadius'))) ? Number(searchParams.get('fromRadius')) : 30;
  const toRadius = RADIUS_VALUES.has(Number(searchParams.get('toRadius'))) ? Number(searchParams.get('toRadius')) : 100;
  const vehicle = searchParams.get('vehicle')?.trim().toLowerCase() ?? '';
  const minVehicle = searchParams.get('minVehicle')?.trim().toLowerCase() ?? '';
  const maxVehicle = searchParams.get('maxVehicle')?.trim().toLowerCase() ?? '';
  const body = searchParams.get('body')?.trim().toLowerCase() ?? '';
  const freight = searchParams.get('freight')?.trim().toLowerCase() ?? '';
  const member = searchParams.get('member')?.trim().toLowerCase() ?? '';
  const description = searchParams.get('description')?.trim().toLowerCase() ?? '';
  const requestedLoadType = searchParams.get('loadType')?.trim().toLowerCase() ?? 'all';
  const postedWithinHours = marketplaceNumber(searchParams.get('postedWithinHours'));
  const dateFrom = searchParams.get('dateFrom')?.trim() ?? '';
  const dateTo = searchParams.get('dateTo')?.trim() ?? '';
  const minBudget = marketplaceNumber(searchParams.get('minBudget'));
  const maxBudget = marketplaceNumber(searchParams.get('maxBudget'));
  const pageSize = PAGE_SIZES.has(Number(searchParams.get('pageSize'))) ? Number(searchParams.get('pageSize')) : 25;
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  let query = supabaseAdmin
    .from('jobs')
    .select(SEARCH_SELECT)
    .in('status', ['posted', 'quoted'])
    .not('exchange_posted_at', 'is', null)
    .is('awarded_carrier_company_id', null)
    .order('exchange_posted_at', { ascending: false })
    .limit(250);

  if (driver.companyId) {
    query = query
      .or(`exchange_visibility.eq.exchange,and(exchange_visibility.eq.direct,direct_invite_company_id.eq.${driver.companyId})`)
      .neq('company_id', driver.companyId);
  } else {
    query = query.eq('exchange_visibility', 'exchange');
  }

  if (vehicle) {
    query = query.or(`vehicle_type.ilike.%${vehicle}%,requested_vehicle_type.ilike.%${vehicle}%,requested_vehicle_label.ilike.%${vehicle}%`);
  }
  if (freight) query = query.or(`cargo_type.ilike.%${freight}%,requested_cargo_label.ilike.%${freight}%`);
  if (minBudget !== null) query = query.gte('budget_amount', minBudget);
  if (maxBudget !== null) query = query.lte('budget_amount', maxBudget);
  if (dateFrom) query = query.gte('pickup_datetime', `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte('pickup_datetime', `${dateTo}T23:59:59`);
  if (postedWithinHours !== null && postedWithinHours > 0) {
    query = query.gte('exchange_posted_at', new Date(Date.now() - postedWithinHours * 3_600_000).toISOString());
  }

  const { data, error } = await query;
  if (error) {
    return operationalError({
      message: 'The marketplace search could not be completed. Please retry.',
      context: 'driver.search-loads.query',
      cause: error,
    });
  }

  const rows = ((data ?? []) as unknown as SearchLoadRow[]).filter((row) => exchangePostActive(row));
  const geocoded = await postcodeCoordinates([
    ...rows.map((row) => row.pickup_postcode),
    ...rows.map((row) => row.delivery_postcode),
  ]);
  const [fromCoordinates, toCoordinates] = await Promise.all([
    from ? resolveSearchCoordinates(from) : Promise.resolve(null),
    to ? resolveSearchCoordinates(to) : Promise.resolve(null),
  ]);
  const fromNeedle = from.toLowerCase();
  const toNeedle = to.toLowerCase();

  const enriched = rows.map((row) => {
    const pickupCoordinates = validCoordinates(row.pickup_lat, row.pickup_lng)
      ?? geocoded.get(postcodeKey(row.pickup_postcode))
      ?? null;
    const deliveryCoordinates = validCoordinates(row.delivery_lat, row.delivery_lng)
      ?? geocoded.get(postcodeKey(row.delivery_postcode))
      ?? null;
    const fromMiles = fromCoordinates && pickupCoordinates ? distanceMiles(fromCoordinates, pickupCoordinates) : null;
    const toMiles = toCoordinates && deliveryCoordinates ? distanceMiles(toCoordinates, deliveryCoordinates) : null;
    const company = companyInfo(row.companies);
    const publicNotes = publicQuoteNotes(row.load_details);
    const requirementFlags = quoteSafeRequirementFlags(row);
    const proposedPrice = proposedPriceAmount(row.budget_amount);

    return {
      id: row.id,
      company_id: row.company_id,
      status: row.status,
      current_status: row.current_status,
      pickup_location: publicAreaLabel(row.pickup_postcode, row.pickup_country_code, 'Collection area TBC'),
      pickup_postcode: publicOutcode(row.pickup_postcode),
      pickup_datetime: row.pickup_datetime,
      pickup_time_slot: row.pickup_time_slot,
      delivery_location: publicAreaLabel(row.delivery_postcode, row.delivery_country_code, 'Delivery area TBC'),
      delivery_postcode: publicOutcode(row.delivery_postcode),
      delivery_datetime: row.delivery_datetime,
      delivery_time_slot: row.delivery_time_slot,
      pickup_country_code: row.pickup_country_code,
      delivery_country_code: row.delivery_country_code,
      vehicle_type: row.vehicle_type,
      requested_vehicle_type: row.requested_vehicle_type,
      requested_vehicle_label: row.requested_vehicle_label,
      cargo_type: row.cargo_type,
      requested_cargo_label: row.requested_cargo_label,
      pallets: marketplaceNumber(row.pallets),
      weight_kg: marketplaceNumber(row.weight_kg),
      budget_amount: proposedPrice,
      currency: marketplaceText(row.currency) ?? 'GBP',
      is_fixed_price: row.is_fixed_price === true,
      load_details: publicNotes,
      special_requirements: requirementFlags.join(', ') || null,
      access_restrictions: null,
      service_mode: row.service_mode,
      direct_delivery_required: row.direct_delivery_required === true,
      distance_miles: marketplaceNumber(row.distance_miles),
      job_distance_miles: marketplaceNumber(row.job_distance_miles),
      exchange_posted_at: row.exchange_posted_at,
      posterName: company?.name ?? 'Marketplace member',
      posterMemberCode: company?.company_number ?? null,
      posterPhone: company?.phone ?? null,
      posterMemberType: company?.company_type ?? null,
      posterMemberSince: company?.created_at ?? null,
      distanceFromSearchOriginMiles: fromMiles == null ? null : Number(fromMiles.toFixed(1)),
      distanceToSearchDestinationMiles: toMiles == null ? null : Number(toMiles.toFixed(1)),
      jobDescription: jobDescription(row),
      loadType: loadType(row),
      journeyDistanceMiles: marketplaceNumber(row.job_distance_miles) ?? marketplaceNumber(row.distance_miles),
    };
  });

  const filtered = enriched.filter((row) => {
    const pickupText = `${row.pickup_location ?? ''} ${row.pickup_postcode ?? ''}`.toLowerCase();
    const deliveryText = `${row.delivery_location ?? ''} ${row.delivery_postcode ?? ''}`.toLowerCase();
    const bodyText = `${row.vehicle_type ?? ''} ${row.requested_vehicle_type ?? ''} ${row.requested_vehicle_label ?? ''} ${row.special_requirements ?? ''}`.toLowerCase();
    const memberText = `${row.posterName} ${row.posterMemberCode ?? ''} ${row.company_id ?? ''} ${row.id}`.toLowerCase();
    const comparableVehicle = row.requested_vehicle_type ?? row.vehicle_type ?? row.requested_vehicle_label;

    if (fromNeedle) {
      if (fromCoordinates) {
        if (row.distanceFromSearchOriginMiles == null || row.distanceFromSearchOriginMiles > fromRadius) return false;
      } else if (!pickupText.includes(fromNeedle)) return false;
    }
    if (toNeedle) {
      if (toCoordinates) {
        if (row.distanceToSearchDestinationMiles == null || row.distanceToSearchDestinationMiles > toRadius) return false;
      } else if (!deliveryText.includes(toNeedle)) return false;
    }
    if ((minVehicle || maxVehicle) && !vehicleMatchesMarketplaceSizeRange(comparableVehicle, minVehicle, maxVehicle)) return false;
    if (body && !bodyText.includes(body)) return false;
    if (member && !memberText.includes(member)) return false;
    if (description && description !== 'any' && row.jobDescription !== description) return false;
    if (requestedLoadType !== 'all' && row.loadType !== requestedLoadType) return false;
    return true;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pagedRows = filtered.slice(start, start + pageSize);

  return respond(200, {
    rows: pagedRows,
    driverId: driver.driverId,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    radiusSearch: {
      fromResolved: Boolean(fromCoordinates),
      toResolved: Boolean(toCoordinates),
      fromRadius,
      toRadius,
    },
    generatedAt: new Date().toISOString(),
  });
}
