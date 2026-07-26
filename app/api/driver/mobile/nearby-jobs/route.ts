import { NextRequest } from 'next/server';
import { sortSmartDestinationCandidates } from '../../../../../lib/smartDestinationPriority';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

type NearbyJobRow = {
  id: string;
  company_id: string | null;
  status: string | null;
  exchange_visibility: string | null;
  awarded_carrier_company_id: string | null;
  assigned_company_id?: string | null;
  assigned_driver_id: string | null;
  direct_invite_company_id: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_datetime: string | null;
  delivery_time_slot: string | null;
  pickup_country_code?: string | null;
  delivery_country_code?: string | null;
  service_mode?: string | null;
  direct_delivery_required?: boolean | null;
  vehicle_type: string | null;
  requested_vehicle_type?: string | null;
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
  access_restrictions: string | null;
  job_distance_miles: number | string | null;
  job_distance_minutes: number | null;
  distance_to_pickup_miles: number | string | null;
  exchange_posted_at: string | null;
  companies?: { name?: string | null; company_number?: string | null } | Array<{ name?: string | null; company_number?: string | null }> | null;
};

const nearbySelect = [
  'id',
  'company_id',
  'status',
  'exchange_visibility',
  'awarded_carrier_company_id',
  'assigned_company_id',
  'assigned_driver_id',
  'direct_invite_company_id',
  'pickup_location',
  'pickup_postcode',
  'pickup_lat',
  'pickup_lng',
  'pickup_datetime',
  'pickup_time_slot',
  'delivery_location',
  'delivery_postcode',
  'delivery_lat',
  'delivery_lng',
  'delivery_datetime',
  'delivery_time_slot',
  'pickup_country_code',
  'delivery_country_code',
  'service_mode',
  'direct_delivery_required',
  'vehicle_type',
  'requested_vehicle_type',
  'requested_vehicle_label',
  'cargo_type',
  'requested_cargo_label',
  'pallets',
  'weight_kg',
  'budget_amount',
  'currency',
  'is_fixed_price',
  'load_details',
  'special_requirements',
  'access_restrictions',
  'job_distance_miles',
  'exchange_posted_at',
  'companies(name,company_number)',
].join(',');

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function companyInfo(companies: NearbyJobRow['companies']) {
  if (Array.isArray(companies)) return companies[0] ?? null;
  return companies ?? null;
}

function publicArea(postcode: unknown) {
  const value = String(postcode ?? '').trim().toUpperCase();
  return value ? `Approx. area · ${value.split(/\s+/)[0]}` : 'Area disclosed after allocation';
}

function mapNearbyJob(row: NearbyJobRow, extras: Record<string, unknown> = {}) {
  const hasProposedPrice = row.budget_amount != null && Number(row.budget_amount) > 0;
  const company = companyInfo(row.companies);
  return {
    id: row.id,
    publicReference: `XDL-${row.id.slice(0, 8).toUpperCase()}`,
    poster: { name: company?.name ?? null, memberCode: company?.company_number ?? null },
    posterCompanyName: company?.name ?? null,
    pickup: {
      addressSummary: publicArea(row.pickup_postcode),
      postcode: row.pickup_postcode || '',
      latitude: null,
      longitude: null,
      collectionFrom: row.pickup_datetime || row.pickup_time_slot || null,
      collectionTo: null,
    },
    delivery: {
      addressSummary: publicArea(row.delivery_postcode),
      postcode: row.delivery_postcode || '',
      latitude: null,
      longitude: null,
      deliveryFrom: row.delivery_datetime || row.delivery_time_slot || null,
      deliveryTo: null,
    },
    vehicleType: row.requested_vehicle_label || row.requested_vehicle_type || row.vehicle_type || null,
    bodyType: row.vehicle_type || null,
    pallets: numberOrNull(row.pallets),
    weightKg: numberOrNull(row.weight_kg),
    freightType: row.requested_cargo_label || row.cargo_type || null,
    notesSummary: null,
    distanceToPickupMiles: numberOrNull(row.distance_to_pickup_miles),
    journeyDistanceMiles: numberOrNull(row.job_distance_miles),
    estimatedJourneyMinutes: numberOrNull(row.job_distance_minutes),
    publicPrice: {
      visible: hasProposedPrice,
      amount: hasProposedPrice ? numberOrNull(row.budget_amount) : null,
      currency: hasProposedPrice ? row.currency || 'GBP' : null,
    },
    hasProposedPrice,
    proposedPriceGbp: hasProposedPrice ? numberOrNull(row.budget_amount) : null,
    canQuote: true,
    canSave: true,
    expiresAt: null,
    pickupCountryCode: row.pickup_country_code || 'GB',
    deliveryCountryCode: row.delivery_country_code || 'GB',
    serviceMode: row.service_mode || null,
    directDeliveryRequired: row.direct_delivery_required === true,
    ...extras,
  };
}

type Coordinates = { lat: number; lng: number };

function validCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng) ? { lat: parsedLat, lng: parsedLng } : null;
}

function postcodeKey(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
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
    const payload = await response.json() as { result?: Array<{ query?: string; result?: { latitude?: number; longitude?: number } | null }> };
    for (const item of payload.result ?? []) {
      const coordinates = validCoordinates(item.result?.latitude, item.result?.longitude);
      if (coordinates) result.set(postcodeKey(item.query), coordinates);
    }
  } catch {
    // Postcode enrichment is best-effort; keep available jobs when lookup fails.
  }
  return result;
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

function jobTime(value: unknown) {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function isInternational(row: NearbyJobRow) {
  return String(row.delivery_country_code || 'GB').toUpperCase() !== 'GB';
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim().toLowerCase() ?? '';
  const limit = Math.min(Number(searchParams.get('limit') ?? 50) || 50, 100);
  const destinationMode = searchParams.get('mode') === 'destination';

  let query = supabaseAdmin
    .from('jobs')
    .select(nearbySelect)
    .or(driver.companyId
      ? `exchange_visibility.eq.exchange,and(exchange_visibility.eq.direct,direct_invite_company_id.eq.${driver.companyId})`
      : 'exchange_visibility.eq.exchange')
    .eq('status', 'posted')
    .is('awarded_carrier_company_id', null)
    .order('exchange_posted_at', { ascending: false })
    .limit(limit);

  if (driver.companyId) {
    query = query.neq('company_id', driver.companyId);
  }

  if (search) {
    query = query.or(`pickup_location.ilike.%${search}%,pickup_postcode.ilike.%${search}%,delivery_location.ilike.%${search}%,delivery_postcode.ilike.%${search}%,vehicle_type.ilike.%${search}%,requested_vehicle_label.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  const rows = (data ?? []) as unknown as NearbyJobRow[];
  const commercialBidExtras = driver.canCommercialBid
    ? {}
    : {
        canQuote: false,
        quoteWarning: 'Your account type does not permit commercial bidding.',
      };
  if (!destinationMode) {
    return respond(200, { jobs: rows.map((row) => mapNearbyJob(row, commercialBidExtras)) });
  }

  const { data: currentJob, error: currentJobError } = await supabaseAdmin
    .from('jobs')
    .select('id,delivery_postcode,delivery_lat,delivery_lng,delivery_datetime,delivery_time_slot,status,updated_at')
    .eq('assigned_driver_id', driver.driverId)
    .in('status', ['allocated', 'collected', 'in_transit', 'delivered'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentJobError) return respond(500, { error: currentJobError.message });
  if (!currentJob) {
    return respond(200, { jobs: rows.map((row) => mapNearbyJob(row, commercialBidExtras)), returnIq: { active: false, reason: 'No active delivery is assigned to this driver.' } });
  }
  if (!['in_transit', 'delivered'].includes(String(currentJob.status))) {
    return respond(200, { jobs: rows.map((row) => mapNearbyJob(row, commercialBidExtras)), returnIq: { active: false, reason: 'Activates when the driver is on the way to delivery.' } });
  }

  const geocoded = await postcodeCoordinates([currentJob.delivery_postcode, ...rows.map((row) => row.pickup_postcode)]);
  const destination = validCoordinates(currentJob.delivery_lat, currentJob.delivery_lng)
    ?? geocoded.get(postcodeKey(currentJob.delivery_postcode))
    ?? null;
  if (!destination) {
    return respond(200, {
      jobs: rows.map((row) => mapNearbyJob(row, commercialBidExtras)),
      returnIq: {
        active: false,
        currentJobReference: `XDL-${String(currentJob.id).slice(0, 8).toUpperCase()}`,
        destinationArea: publicArea(currentJob.delivery_postcode),
        reason: 'The delivery postcode could not be located yet.',
      },
    });
  }

  const availableAfter = currentJob.delivery_datetime || currentJob.delivery_time_slot || null;
  const availableAfterMs = jobTime(availableAfter);
  const requestedRadius = searchParams.get('radius');
  const radiusMiles = ['10', '20', '30'].includes(String(requestedRadius)) ? Number(requestedRadius) : 10;

  const [driverAccess, companyAccess, vehicleAccess] = await Promise.all([
    supabaseAdmin.from('drivers').select('international_work_approved').eq('id', driver.driverId).maybeSingle(),
    driver.companyId
      ? supabaseAdmin.from('companies').select('international_work_approved').eq('id', driver.companyId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from('vehicles').select('international_work_approved,type').eq('assigned_driver_id', driver.driverId).maybeSingle(),
  ]);
  const internationalApproved = driverAccess.data?.international_work_approved === true
    && companyAccess.data?.international_work_approved === true
    && vehicleAccess.data?.international_work_approved === true;

  const vehicleRank: Record<string, number> = { small_van: 1, van_small: 1, swb_van: 2, mwb_van: 3, lwb_van: 4, xlwb_van: 5, luton: 6, luton_tail_lift: 6, truck_3_5t: 7, truck_5t: 8, truck_7_5t: 9, truck_12t: 10, truck_18t: 11, truck_26t: 12 };
  const normalizeVehicle = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[ .-]+/g, '_');
  const assignedVehicle = normalizeVehicle(vehicleAccess.data?.type);
  const assignedRank = vehicleRank[assignedVehicle] ?? 0;

  const candidates = rows.map((row, originalIndex) => {
    const pickup = validCoordinates(row.pickup_lat, row.pickup_lng) ?? geocoded.get(postcodeKey(row.pickup_postcode)) ?? null;
    const pickupMs = jobTime(row.pickup_datetime || row.pickup_time_slot);
    const timingImpossible = availableAfterMs !== null && pickupMs !== null && pickupMs < availableAfterMs;
    const miles = pickup ? distanceMiles(destination, pickup) : null;
    const closeTiming = availableAfterMs !== null && pickupMs !== null && pickupMs - availableAfterMs < 90 * 60_000;
    const needsInternationalApproval = isInternational(row) && !internationalApproved;
    const requiredVehicle = normalizeVehicle(row.requested_vehicle_type || row.vehicle_type);
    const requiredRank = vehicleRank[requiredVehicle] ?? 0;
    const vehicleCompatible = Boolean(assignedVehicle) && (requiredRank > 0 && assignedRank > 0 ? assignedRank >= requiredRank : assignedVehicle === requiredVehicle);
    const destinationPriority = miles !== null && miles <= radiusMiles && !timingImpossible && vehicleCompatible && !needsInternationalApproval;
    return {
      row,
      miles,
      pickupMs,
      originalIndex,
      destinationPriority,
      extras: {
        distanceFromCurrentDeliveryMiles: miles === null ? null : Number(miles.toFixed(1)),
        destinationPriority,
        canQuote: !needsInternationalApproval && driver.canCommercialBid,
        internationalEligibilityRequired: needsInternationalApproval,
        quoteWarning: !driver.canCommercialBid
          ? 'Your account type does not permit commercial bidding.'
          : needsInternationalApproval
            ? 'International eligibility must be approved for the company, driver and assigned vehicle.'
            : timingImpossible
              ? 'Timing conflict: collection is before the current delivery ETA.'
            : closeTiming
              ? 'Collection is close to the current ETA. Confirm unloading and travel time before quoting.'
              : null,
      },
    };
  });

  const prioritizedJobs = sortSmartDestinationCandidates(candidates)
    .map((item) => mapNearbyJob(item.row, item.extras));

  return respond(200, {
    jobs: prioritizedJobs,
    returnIq: {
      active: true,
      currentJobReference: `XDL-${String(currentJob.id).slice(0, 8).toUpperCase()}`,
      destinationArea: publicArea(currentJob.delivery_postcode),
      availableAfter,
      radiusMiles,
    },
  });
}
