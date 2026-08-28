import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { marketplaceNumber, proposedPriceAmount, publicOutcode, publicQuoteNotes } from '../../_lib/marketplacePublic';
import { isDriverContext, requireDriver, respond } from '../_lib';

const VEHICLE_RANK: Record<string, number> = {
  car: 0, small_van: 1, van_small: 1, swb_van: 2, mwb_van: 3, van_large: 4,
  lwb_van: 4, xlwb_van: 5, luton: 6, luton_tail_lift: 6, truck_3_5t: 7,
  truck_5t: 8, truck_7_5t: 9, truck_12t: 10, truck_18t: 11, truck_26t: 12, artic: 13,
};

type CompanyRef = { name?: string | null; company_number?: string | null; company_type?: string | null; created_at?: string | null } | Array<{ name?: string | null; company_number?: string | null; company_type?: string | null; created_at?: string | null }> | null;
type Row = {
  id: string; company_id: string | null; status: string | null; exchange_visibility: string | null; direct_invite_company_id: string | null;
  pickup_postcode: string | null; pickup_datetime: string | null; pickup_time_slot: string | null; pickup_country_code: string | null;
  delivery_postcode: string | null; delivery_datetime: string | null; delivery_time_slot: string | null; delivery_country_code: string | null;
  vehicle_type: string | null; requested_vehicle_type: string | null; requested_vehicle_label: string | null;
  cargo_type: string | null; requested_cargo_label: string | null; pallets: number | null; weight_kg: number | string | null;
  budget_amount: number | string | null; currency: string | null; load_details: string | null; job_distance_miles: number | string | null;
  job_distance_minutes: number | null; exchange_posted_at: string | null; exchange_expires_at: string | null; service_mode: string | null;
  direct_delivery_required: boolean | null; companies: CompanyRef;
};

const SELECT = [
  'id','company_id','status','exchange_visibility','direct_invite_company_id',
  'pickup_postcode','pickup_datetime','pickup_time_slot','pickup_country_code',
  'delivery_postcode','delivery_datetime','delivery_time_slot','delivery_country_code',
  'vehicle_type','requested_vehicle_type','requested_vehicle_label','cargo_type','requested_cargo_label','pallets','weight_kg',
  'budget_amount','currency','load_details','job_distance_miles','job_distance_minutes','exchange_posted_at','exchange_expires_at',
  'service_mode','direct_delivery_required','companies(name,company_number,company_type,created_at)',
].join(',');

function company(value: CompanyRef) { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function normalize(value: unknown) { return String(value ?? '').trim().toLowerCase().replace(/[ .-]+/g, '_'); }
function time(value: unknown) { const result = new Date(String(value ?? '')).getTime(); return Number.isFinite(result) ? result : null; }
function outcode(value: unknown) { return publicOutcode(value) ?? ''; }
function publicArea(value: unknown) { const code = outcode(value); return code ? `Approx. area · ${code}` : 'Area disclosed after allocation'; }
function dateFilter(value: string | null, endOfDay = false) {
  if (!value) return null;
  const suffix = /^\d{4}-\d{2}-\d{2}$/.test(value) ? (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z') : '';
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}
function rowVehicleRank(row: Row) { return VEHICLE_RANK[normalize(row.requested_vehicle_type || row.vehicle_type)] ?? null; }
function rowText(row: Row) {
  const member = company(row.companies);
  return [outcode(row.pickup_postcode), outcode(row.delivery_postcode), row.requested_vehicle_label, row.requested_vehicle_type, row.vehicle_type, row.requested_cargo_label, row.cargo_type, member?.name, member?.company_number, row.id]
    .filter(Boolean).join(' ').toLowerCase();
}

function project(row: Row, canCommercialBid: boolean) {
  const member = company(row.companies);
  const price = proposedPriceAmount(row.budget_amount);
  return {
    id: row.id,
    publicReference: `XDL-${row.id.slice(0, 8).toUpperCase()}`,
    poster: { name: member?.name ?? null, memberCode: member?.company_number ?? null, memberType: member?.company_type ?? null, memberSince: member?.created_at ?? null },
    pickup: { addressSummary: publicArea(row.pickup_postcode), postcode: outcode(row.pickup_postcode), collectionFrom: row.pickup_datetime || row.pickup_time_slot || null },
    delivery: { addressSummary: publicArea(row.delivery_postcode), postcode: outcode(row.delivery_postcode), deliveryFrom: row.delivery_datetime || row.delivery_time_slot || null },
    vehicleType: row.requested_vehicle_label || row.requested_vehicle_type || row.vehicle_type || null,
    freightType: row.requested_cargo_label || row.cargo_type || null,
    pallets: marketplaceNumber(row.pallets),
    weightKg: marketplaceNumber(row.weight_kg),
    notesSummary: publicQuoteNotes(row.load_details),
    journeyDistanceMiles: marketplaceNumber(row.job_distance_miles),
    estimatedJourneyMinutes: marketplaceNumber(row.job_distance_minutes),
    publicPrice: { visible: price !== null, amount: price, currency: price !== null ? row.currency || 'GBP' : null },
    proposedPriceGbp: price,
    canQuote: canCommercialBid,
    quoteWarning: canCommercialBid ? null : 'Your account type does not permit commercial bidding.',
    expiresAt: row.exchange_expires_at,
    pickupCountryCode: row.pickup_country_code || 'GB',
    deliveryCountryCode: row.delivery_country_code || 'GB',
    serviceMode: row.service_mode,
    directDeliveryRequired: row.direct_delivery_required === true,
  };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const p = new URL(request.url).searchParams;
  const queryText = p.get('q')?.trim().toLowerCase() ?? '';
  const fromText = p.get('from')?.trim().toLowerCase() ?? '';
  const toText = p.get('to')?.trim().toLowerCase() ?? '';
  const freight = normalize(p.get('freightType'));
  const member = p.get('member')?.trim().toLowerCase() ?? '';
  const region = normalize(p.get('region')) || 'uk_roi';
  const vehicleFrom = VEHICLE_RANK[normalize(p.get('vehicleFrom'))];
  const vehicleTo = VEHICLE_RANK[normalize(p.get('vehicleTo'))];
  const dateFrom = dateFilter(p.get('dateFrom'));
  const dateTo = dateFilter(p.get('dateTo'), true);
  const limit = Math.min(100, Math.max(1, Number(p.get('limit') ?? 50) || 50));

  let db = supabaseAdmin
    .from('jobs')
    .select(SELECT)
    .or(driver.companyId ? `exchange_visibility.eq.exchange,and(exchange_visibility.eq.direct,direct_invite_company_id.eq.${driver.companyId})` : 'exchange_visibility.eq.exchange')
    .in('status', ['posted', 'quoted'])
    .is('awarded_carrier_company_id', null)
    .order('exchange_posted_at', { ascending: false })
    .limit(500);
  if (driver.companyId) db = db.neq('company_id', driver.companyId);

  const { data, error } = await db;
  if (error) return respond(500, { error: error.message });
  const now = Date.now();
  const rows = ((data ?? []) as unknown as Row[]).filter((row) => {
    const expires = time(row.exchange_expires_at);
    if (expires !== null && expires <= now) return false;
    if (queryText && !rowText(row).includes(queryText)) return false;
    if (fromText && ![outcode(row.pickup_postcode), publicArea(row.pickup_postcode)].join(' ').toLowerCase().includes(fromText)) return false;
    if (toText && ![outcode(row.delivery_postcode), publicArea(row.delivery_postcode)].join(' ').toLowerCase().includes(toText)) return false;
    if (freight && normalize(row.requested_cargo_label || row.cargo_type) !== freight) return false;
    const companyText = [company(row.companies)?.name, company(row.companies)?.company_number].filter(Boolean).join(' ').toLowerCase();
    if (member && !companyText.includes(member)) return false;
    const pickup = time(row.pickup_datetime || row.pickup_time_slot);
    if (dateFrom !== null && (pickup === null || pickup < dateFrom)) return false;
    if (dateTo !== null && (pickup === null || pickup > dateTo)) return false;
    const rank = rowVehicleRank(row);
    if (vehicleFrom !== undefined && (rank === null || rank < vehicleFrom)) return false;
    if (vehicleTo !== undefined && (rank === null || rank > vehicleTo)) return false;
    const pickupCountry = String(row.pickup_country_code || 'GB').toUpperCase();
    const deliveryCountry = String(row.delivery_country_code || 'GB').toUpperCase();
    const international = pickupCountry !== 'GB' || deliveryCountry !== 'GB';
    if (region === 'uk_roi' && international && !['IE', 'IM', 'JE', 'GG'].includes(pickupCountry) && !['IE', 'IM', 'JE', 'GG'].includes(deliveryCountry)) return false;
    if (region === 'euro' && !international) return false;
    return true;
  }).slice(0, limit);

  return respond(200, {
    jobs: rows.map((row) => project(row, driver.canCommercialBid)),
    filters: { q: queryText, from: fromText, to: toText, freightType: freight || null, member: member || null, region, vehicleFrom: p.get('vehicleFrom'), vehicleTo: p.get('vehicleTo'), dateFrom: p.get('dateFrom'), dateTo: p.get('dateTo') },
    count: rows.length,
  });
}
