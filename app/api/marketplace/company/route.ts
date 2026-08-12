import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const OPERATOR_ROLES = new Set(['owner', 'admin', 'dispatcher', 'member']);
const RADIUS_VALUES = new Set([10, 20, 30, 50, 100, 200, 300]);
const PAGE_SIZES = new Set([10, 25, 50]);

type Coordinates = { lat: number; lng: number };
type CompanyRef =
  | { name?: string | null; company_number?: string | null }
  | Array<{ name?: string | null; company_number?: string | null }>
  | null;

type SearchLoadRow = {
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
  customer_reference: string | null;
  booking_reference: string | null;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  service_mode: string | null;
  direct_delivery_required: boolean | null;
  distance_miles: number | string | null;
  job_distance_miles: number | string | null;
  exchange_posted_at: string | null;
  exchange_visibility: string | null;
  direct_invite_company_id: string | null;
  companies: CompanyRef;
};

type BidRow = {
  id: string;
  job_id: string;
  company_id: string | null;
  amount: number | string | null;
  bid_price_gbp: number | string | null;
  currency: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

const SEARCH_SELECT = [
  'id', 'company_id', 'status', 'current_status',
  'pickup_location', 'pickup_postcode', 'pickup_lat', 'pickup_lng', 'pickup_datetime', 'pickup_time_slot',
  'delivery_location', 'delivery_postcode', 'delivery_lat', 'delivery_lng', 'delivery_datetime', 'delivery_time_slot',
  'vehicle_type', 'requested_vehicle_type', 'requested_vehicle_label',
  'cargo_type', 'requested_cargo_label', 'pallets', 'weight_kg',
  'budget_amount', 'currency', 'is_fixed_price',
  'customer_reference', 'booking_reference', 'load_details', 'special_requirements', 'access_restrictions',
  'service_mode', 'direct_delivery_required', 'distance_miles', 'job_distance_miles',
  'exchange_posted_at', 'exchange_visibility', 'direct_invite_company_id',
  'companies!jobs_company_id_fkey(name,company_number)',
].join(',');

const bidActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('submit_bid'),
    companyId: z.string().uuid(),
    jobId: z.string().uuid(),
    amount: z.number().finite().positive().max(1_000_000),
    message: z.string().trim().max(2000).optional().nullable(),
  }),
  z.object({
    action: z.literal('withdraw_bid'),
    companyId: z.string().uuid(),
    bidId: z.string().uuid(),
  }),
]);

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : null;
}

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
    // Best-effort enrichment only; text filtering remains available.
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
  const notes = `${row.load_details ?? ''} ${row.special_requirements ?? ''}`.toLowerCase();
  if (service.includes('multi') || notes.includes('multi-drop') || notes.includes('multi drop')) return 'multi_drop';
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

async function resolveCompanyOperator(request: NextRequest, companyId: string) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { kind: 'config' as const };
  const token = getBearerToken(request);
  if (!token) return { kind: 'unauthorized' as const };

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return { kind: 'unauthorized' as const };

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company, companies!inner(status)')
    .eq('company_id', companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return { kind: 'error' as const, cause: membershipError, userId: authData.user.id };
  }

  const role = String(membership?.role_in_company ?? '');
  const companyJoin = membership?.companies as unknown as { status?: string | null } | Array<{ status?: string | null }> | null | undefined;
  const company = Array.isArray(companyJoin) ? companyJoin[0] : companyJoin;
  if (!membership || company?.status !== 'active' || !OPERATOR_ROLES.has(role)) {
    return { kind: 'forbidden' as const, userId: authData.user.id };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (profileError) return { kind: 'error' as const, cause: profileError, userId: authData.user.id };
  if (String(profile?.role ?? '') === 'driver') return { kind: 'forbidden' as const, userId: authData.user.id };

  return { kind: 'ok' as const, userId: authData.user.id, companyId, role };
}

function authResponse(result: Awaited<ReturnType<typeof resolveCompanyOperator>>, context: string) {
  if (result.kind === 'config') {
    return operationalError({ status: 503, message: 'Marketplace services are temporarily unavailable.', context: `${context}.config`, retryable: true });
  }
  if (result.kind === 'unauthorized') return respond(401, { error: 'Your session has expired. Sign in again.' });
  if (result.kind === 'forbidden') return respond(403, { error: 'You do not have access to this company marketplace.' });
  if (result.kind === 'error') {
    return operationalError({ status: 500, message: 'We could not verify your company access. Please try again.', context: `${context}.membership`, cause: result.cause, retryable: true });
  }
  return null;
}

async function searchLoads(request: NextRequest, companyId: string) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from')?.trim() ?? '';
  const to = searchParams.get('to')?.trim() ?? '';
  const fromRadius = RADIUS_VALUES.has(Number(searchParams.get('fromRadius'))) ? Number(searchParams.get('fromRadius')) : 30;
  const toRadius = RADIUS_VALUES.has(Number(searchParams.get('toRadius'))) ? Number(searchParams.get('toRadius')) : 100;
  const vehicle = searchParams.get('vehicle')?.trim().toLowerCase() ?? '';
  const body = searchParams.get('body')?.trim().toLowerCase() ?? '';
  const freight = searchParams.get('freight')?.trim().toLowerCase() ?? '';
  const member = searchParams.get('member')?.trim().toLowerCase() ?? '';
  const description = searchParams.get('description')?.trim().toLowerCase() ?? '';
  const requestedLoadType = searchParams.get('loadType')?.trim().toLowerCase() ?? 'all';
  const postedWithinHours = numberOrNull(searchParams.get('postedWithinHours'));
  const dateFrom = searchParams.get('dateFrom')?.trim() ?? '';
  const dateTo = searchParams.get('dateTo')?.trim() ?? '';
  const minBudget = numberOrNull(searchParams.get('minBudget'));
  const maxBudget = numberOrNull(searchParams.get('maxBudget'));
  const pageSize = PAGE_SIZES.has(Number(searchParams.get('pageSize'))) ? Number(searchParams.get('pageSize')) : 25;
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  let query = supabaseAdmin!
    .from('jobs')
    .select(SEARCH_SELECT)
    .eq('status', 'posted')
    .not('exchange_posted_at', 'is', null)
    .is('awarded_carrier_company_id', null)
    .or(`exchange_visibility.eq.exchange,and(exchange_visibility.eq.direct,direct_invite_company_id.eq.${companyId})`)
    .neq('company_id', companyId)
    .order('exchange_posted_at', { ascending: false })
    .limit(250);

  if (vehicle) query = query.or(`vehicle_type.ilike.%${vehicle}%,requested_vehicle_type.ilike.%${vehicle}%,requested_vehicle_label.ilike.%${vehicle}%`);
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
      context: `marketplace.company.search.company:${companyId}`,
      cause: error,
      retryable: true,
    });
  }

  const rows = (data ?? []) as unknown as SearchLoadRow[];
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
    const pickupCoordinates = validCoordinates(row.pickup_lat, row.pickup_lng) ?? geocoded.get(postcodeKey(row.pickup_postcode)) ?? null;
    const deliveryCoordinates = validCoordinates(row.delivery_lat, row.delivery_lng) ?? geocoded.get(postcodeKey(row.delivery_postcode)) ?? null;
    const fromMiles = fromCoordinates && pickupCoordinates ? distanceMiles(fromCoordinates, pickupCoordinates) : null;
    const toMiles = toCoordinates && deliveryCoordinates ? distanceMiles(toCoordinates, deliveryCoordinates) : null;
    const company = companyInfo(row.companies);
    return {
      ...row,
      companies: undefined,
      posterName: company?.name ?? 'Marketplace member',
      posterMemberCode: company?.company_number ?? null,
      pickupCoordinates,
      deliveryCoordinates,
      distanceFromSearchOriginMiles: fromMiles == null ? null : Number(fromMiles.toFixed(1)),
      distanceToSearchDestinationMiles: toMiles == null ? null : Number(toMiles.toFixed(1)),
      jobDescription: jobDescription(row),
      loadType: loadType(row),
      journeyDistanceMiles: numberOrNull(row.job_distance_miles) ?? numberOrNull(row.distance_miles),
    };
  });

  const filtered = enriched.filter((row) => {
    const pickupText = `${row.pickup_location ?? ''} ${row.pickup_postcode ?? ''}`.toLowerCase();
    const deliveryText = `${row.delivery_location ?? ''} ${row.delivery_postcode ?? ''}`.toLowerCase();
    const bodyText = `${row.vehicle_type ?? ''} ${row.requested_vehicle_type ?? ''} ${row.requested_vehicle_label ?? ''} ${row.load_details ?? ''}`.toLowerCase();
    const memberText = `${row.posterName} ${row.posterMemberCode ?? ''} ${row.company_id ?? ''} ${row.id} ${row.customer_reference ?? ''} ${row.booking_reference ?? ''}`.toLowerCase();

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
    if (body && !bodyText.includes(body)) return false;
    if (member && !memberText.includes(member)) return false;
    if (description && description !== 'any' && row.jobDescription !== description) return false;
    if (requestedLoadType !== 'all' && row.loadType !== requestedLoadType) return false;
    return true;
  });

  const jobIds = filtered.map((row) => row.id);
  const bidsByJobId = new Map<string, BidRow>();
  if (jobIds.length > 0) {
    const { data: myBids, error: bidsError } = await supabaseAdmin!
      .from('job_bids')
      .select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at')
      .eq('company_id', companyId)
      .in('job_id', jobIds);
    if (bidsError) {
      return operationalError({
        message: 'The marketplace loaded, but your quote status could not be checked. Please retry.',
        context: `marketplace.company.search-bids.company:${companyId}`,
        cause: bidsError,
        retryable: true,
      });
    }
    for (const bid of (myBids ?? []) as unknown as BidRow[]) bidsByJobId.set(bid.job_id, bid);
  }

  const withBids = filtered.map((row) => ({ ...row, myBid: bidsByJobId.get(row.id) ?? null }));
  const total = withBids.length;
  const start = (page - 1) * pageSize;

  return respond(200, {
    view: 'loads',
    rows: withBids.slice(start, start + pageSize),
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

async function loadBids(companyId: string) {
  const { data: bidsData, error: bidsError } = await supabaseAdmin!
    .from('job_bids')
    .select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (bidsError) {
    return operationalError({
      message: 'Your marketplace quotes could not be loaded. Please retry.',
      context: `marketplace.company.bids.company:${companyId}`,
      cause: bidsError,
      retryable: true,
    });
  }

  const bids = (bidsData ?? []) as unknown as BidRow[];
  const jobIds = [...new Set(bids.map((bid) => bid.job_id))];
  const jobsById = new Map<string, Record<string, unknown>>();
  if (jobIds.length > 0) {
    const { data: jobsData, error: jobsError } = await supabaseAdmin!
      .from('jobs')
      .select('id, company_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, vehicle_type, requested_vehicle_label, status, current_status, budget_amount, currency, companies!jobs_company_id_fkey(name,company_number)')
      .in('id', jobIds);
    if (jobsError) {
      return operationalError({
        message: 'Your quotes loaded, but their load details are temporarily unavailable.',
        context: `marketplace.company.bid-jobs.company:${companyId}`,
        cause: jobsError,
        retryable: true,
      });
    }
    for (const raw of jobsData ?? []) {
      const row = raw as unknown as Record<string, unknown> & { companies?: CompanyRef };
      const company = companyInfo(row.companies ?? null);
      jobsById.set(String(row.id), {
        ...row,
        companies: undefined,
        posterName: company?.name ?? 'Marketplace member',
        posterMemberCode: company?.company_number ?? null,
      });
    }
  }

  return respond(200, {
    view: 'bids',
    rows: bids.map((bid) => ({ ...bid, job: jobsById.get(bid.job_id) ?? null })),
    total: bids.length,
    generatedAt: new Date().toISOString(),
  });
}

async function loadWon(companyId: string) {
  const { data, error } = await supabaseAdmin!
    .from('jobs')
    .select('id, company_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, vehicle_type, requested_vehicle_label, status, current_status, budget_amount, currency, awarded_carrier_company_id, created_at, companies!jobs_company_id_fkey(name,company_number)')
    .eq('awarded_carrier_company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return operationalError({
      message: 'Won marketplace work could not be loaded. Please retry.',
      context: `marketplace.company.won.company:${companyId}`,
      cause: error,
      retryable: true,
    });
  }

  const rows = (data ?? []).map((raw) => {
    const row = raw as unknown as Record<string, unknown> & { companies?: CompanyRef };
    const company = companyInfo(row.companies ?? null);
    return {
      ...row,
      companies: undefined,
      posterName: company?.name ?? 'Marketplace member',
      posterMemberCode: company?.company_number ?? null,
    };
  });

  return respond(200, { view: 'won', rows, total: rows.length, generatedAt: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId')?.trim() ?? '';
  if (!companyId || !z.string().uuid().safeParse(companyId).success) {
    return respond(400, { error: 'A valid company workspace is required.' });
  }

  const auth = await resolveCompanyOperator(request, companyId);
  const blocked = authResponse(auth, 'marketplace.company.get');
  if (blocked) return blocked;
  const view = searchParams.get('view')?.trim().toLowerCase() ?? 'loads';
  if (view === 'bids') return loadBids(companyId);
  if (view === 'won') return loadWon(companyId);
  return searchLoads(request, companyId);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({ status: 503, message: 'Marketplace services are temporarily unavailable.', context: 'marketplace.company.post.config', retryable: true });
  }

  const raw = await request.json().catch(() => null);
  const parsed = bidActionSchema.safeParse(raw);
  if (!parsed.success) return respond(400, { error: 'The marketplace action is incomplete or invalid.' });
  const input = parsed.data;

  const auth = await resolveCompanyOperator(request, input.companyId);
  const blocked = authResponse(auth, `marketplace.company.${input.action}`);
  if (blocked) return blocked;
  if (auth.kind !== 'ok') return respond(403, { error: 'You do not have access to this company marketplace.' });

  if (input.action === 'withdraw_bid') {
    const { data: bid, error: bidError } = await supabaseAdmin
      .from('job_bids')
      .select('id, company_id, status')
      .eq('id', input.bidId)
      .eq('company_id', input.companyId)
      .maybeSingle();
    if (bidError) {
      return operationalError({ message: 'We could not verify this quote. Please retry.', context: `marketplace.company.withdraw.lookup:${input.bidId}`, cause: bidError, retryable: true });
    }
    if (!bid) return respond(404, { error: 'Quote not found.' });
    if (bid.status !== 'submitted') return respond(409, { error: 'Only a submitted quote can be withdrawn.' });

    const { error: updateError } = await supabaseAdmin
      .from('job_bids')
      .update({ status: 'withdrawn' })
      .eq('id', input.bidId)
      .eq('company_id', input.companyId)
      .eq('status', 'submitted');
    if (updateError) {
      return operationalError({ message: 'We could not withdraw this quote. Please retry.', context: `marketplace.company.withdraw.update:${input.bidId}`, cause: updateError, retryable: true });
    }
    return respond(200, { ok: true, status: 'withdrawn' });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, status, exchange_visibility, direct_invite_company_id, awarded_carrier_company_id, currency')
    .eq('id', input.jobId)
    .maybeSingle();
  if (jobError) {
    return operationalError({ message: 'We could not verify this load. Please retry.', context: `marketplace.company.bid.job:${input.jobId}`, cause: jobError, retryable: true });
  }
  if (!job) return respond(404, { error: 'Load not found.' });
  if (job.company_id === input.companyId) return respond(403, { error: 'You cannot quote on your own company load.' });
  const visible = job.exchange_visibility === 'exchange'
    || (job.exchange_visibility === 'direct' && job.direct_invite_company_id === input.companyId);
  if (!visible) return respond(404, { error: 'Load not found.' });
  if (job.status !== 'posted' || job.awarded_carrier_company_id) {
    return respond(409, { error: 'This load is no longer open for quotes.' });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('job_bids')
    .select('id, status')
    .eq('job_id', input.jobId)
    .eq('company_id', input.companyId)
    .in('status', ['submitted', 'accepted'])
    .limit(1)
    .maybeSingle();
  if (existingError) {
    return operationalError({ message: 'We could not check your existing quote. Please retry.', context: `marketplace.company.bid.existing:${input.jobId}`, cause: existingError, retryable: true });
  }
  if (existing) return respond(409, { error: 'Your company already has an active quote on this load.' });

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('job_bids')
    .insert({
      job_id: input.jobId,
      company_id: input.companyId,
      bidder_user_id: auth.userId,
      bid_price_gbp: input.amount,
      amount: input.amount,
      currency: job.currency || 'GBP',
      message: input.message?.trim() || null,
      status: 'submitted',
    })
    .select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at')
    .single();

  if (insertError) {
    return operationalError({ message: 'We could not submit this quote. Please retry.', context: `marketplace.company.bid.insert:${input.jobId}`, cause: insertError, retryable: true });
  }

  return respond(201, { ok: true, bid: inserted });
}
