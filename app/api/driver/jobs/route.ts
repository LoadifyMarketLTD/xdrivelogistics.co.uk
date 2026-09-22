import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import {
  driverJobStatusesForScope,
  jobLifecyclePresentationGroup,
} from '../../../../lib/jobs/jobLifecyclePresentation';
import { workspaceJobPresentationStatus } from '../../../../lib/jobs/workspaceJobStage';
import { loadDriverAgreedRates } from '../_lib/commercialRate';
import { isWebDriverContext, requireActiveWebDriver } from '../_lib/webDriverContext';
import { calculateJobRouteMetrics } from '../../_lib/jobRouteMetrics';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type DriverJobRow = {
  id: string;
  status: string | null;
  current_status: string | null;
  assigned_driver_id: string | null;
  assigned_company_id: string | null;
  vehicle_id: string | null;
  company_id: string | null;
  awarded_carrier_company_id: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  pickup_datetime: string | null;
  job_distance_miles: number | string | null;
  job_distance_minutes: number | string | null;
  requested_vehicle_label: string | null;
  requested_vehicle_type: string | null;
  vehicle_type: string | null;
  requested_cargo_label: string | null;
  cargo_type: string | null;
  agreed_rate_gbp: number | string | null;
  agreed_rate: number | string | null;
  currency: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Driver jobs are temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'all';
  const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 250);
  const statusList = driverJobStatusesForScope(scope);

  let query = supabaseAdmin
    .from('jobs')
    .select([
      'id',
      'status',
      'current_status',
      'assigned_driver_id',
      'assigned_company_id',
      'vehicle_id',
      'company_id',
      'awarded_carrier_company_id',
      'pickup_location',
      'pickup_postcode',
      'pickup_lat',
      'pickup_lng',
      'delivery_location',
      'delivery_postcode',
      'delivery_lat',
      'delivery_lng',
      'pickup_datetime',
      'job_distance_miles',
      'job_distance_minutes',
      'requested_vehicle_label',
      'requested_vehicle_type',
      'vehicle_type',
      'requested_cargo_label',
      'cargo_type',
      'agreed_rate_gbp',
      'agreed_rate',
      'currency',
      'created_at',
      'updated_at',
    ].join(','))
    .eq('assigned_driver_id', driver.driverId)
    .order(scope === 'completed' ? 'updated_at' : 'pickup_datetime', { ascending: scope !== 'completed' })
    .limit(limit);

  if (statusList) {
    const statuses = statusList.join(',');
    query = query.or(`current_status.in.(${statuses}),and(current_status.is.null,status.in.(${statuses}))`);
  }

  const { data, error } = await query;
  if (error) return json(500, { error: 'We could not load your assigned jobs.' });

  const rows = (data ?? []) as unknown as DriverJobRow[];

  const missingRouteRows = rows.filter((row) =>
    Number(row.job_distance_miles ?? 0) <= 0
    || Number(row.job_distance_minutes ?? 0) <= 0
    || row.pickup_lat == null || row.pickup_lng == null
    || row.delivery_lat == null || row.delivery_lng == null
  );
  if (missingRouteRows.length) {
    await Promise.all(missingRouteRows.slice(0, 20).map(async (row) => {
      if (!row.pickup_postcode || !row.delivery_postcode) return;
      const route = await calculateJobRouteMetrics([row.pickup_postcode, row.delivery_postcode]);
      if (!route) return;
      row.pickup_lat = route.pickupLat;
      row.pickup_lng = route.pickupLng;
      row.delivery_lat = route.deliveryLat;
      row.delivery_lng = route.deliveryLng;
      row.job_distance_miles = route.distanceMiles;
      row.job_distance_minutes = route.durationMinutes;
      await supabaseAdmin.from('jobs').update({
        pickup_lat: route.pickupLat,
        pickup_lng: route.pickupLng,
        delivery_lat: route.deliveryLat,
        delivery_lng: route.deliveryLng,
        job_distance_miles: route.distanceMiles,
        job_distance_minutes: route.durationMinutes,
      }).eq('id', row.id);
    }));
  }

  const { data: latestDriverLocation } = await supabaseAdmin
    .from('driver_locations')
    .select('lat,lng,recorded_at')
    .eq('driver_id', driver.driverId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const driverLat = Number(latestDriverLocation?.lat);
  const driverLng = Number(latestDriverLocation?.lng);
  const driverPosition = Number.isFinite(driverLat) && Number.isFinite(driverLng)
    ? { lat: driverLat, lng: driverLng }
    : null;
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN?.trim();

  const pickupMetrics = new Map<string, { distanceMiles: number; durationMinutes: number }>();
  if (driverPosition && mapboxToken) {
    await Promise.all(rows.map(async (row) => {
      const pickupLat = Number(row.pickup_lat);
      const pickupLng = Number(row.pickup_lng);
      if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) return;
      try {
        const coords = `${driverPosition.lng},${driverPosition.lat};${pickupLng},${pickupLat}`;
        const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`);
        url.searchParams.set('overview', 'false');
        url.searchParams.set('steps', 'false');
        url.searchParams.set('access_token', mapboxToken);
        const response = await fetch(url, { signal: AbortSignal.timeout(5_000), cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as { routes?: Array<{ distance?: number; duration?: number }> };
        const route = payload.routes?.[0];
        const metres = Number(route?.distance);
        const seconds = Number(route?.duration);
        if (!Number.isFinite(metres) || metres <= 0 || !Number.isFinite(seconds) || seconds <= 0) return;
        pickupMetrics.set(row.id, {
          distanceMiles: Math.round((metres / 1609.344) * 10) / 10,
          durationMinutes: Math.max(1, Math.round(seconds / 60)),
        });
      } catch {
        // Keep metrics unavailable rather than fabricating values.
      }
    }));
  }

  const commercial = await loadDriverAgreedRates(supabaseAdmin, rows);
  const companyIds = [...new Set(rows.map((row) => row.company_id).filter((value): value is string => Boolean(value)))];
  const companyNames = new Map<string, string>();

  if (companyIds.length > 0) {
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .in('id', companyIds);
    for (const company of companies ?? []) {
      if (company.id && company.name) companyNames.set(String(company.id), String(company.name));
    }
  }

  return json(200, {
    scope,
    jobs: rows.map((row) => {
      const canonicalStatus = workspaceJobPresentationStatus(row);
      return {
        id: row.id,
        reference: `XDL-${row.id.slice(0, 8).toUpperCase()}`,
        pickupLocation: row.pickup_location,
        deliveryLocation: row.delivery_location,
        pickupTime: row.pickup_datetime,
        distanceToPickupMiles: pickupMetrics.get(row.id)?.distanceMiles ?? null,
        pickupEtaMinutes: pickupMetrics.get(row.id)?.durationMinutes ?? null,
        jobDistanceMiles: Number(row.job_distance_miles ?? 0) > 0 ? Number(row.job_distance_miles) : null,
        jobDistanceMinutes: Number(row.job_distance_minutes ?? 0) > 0 ? Number(row.job_distance_minutes) : null,
        vehicleType: row.requested_vehicle_label ?? row.requested_vehicle_type ?? row.vehicle_type,
        cargoType: row.requested_cargo_label ?? row.cargo_type,
        canonicalStatus,
        lifecycleGroup: jobLifecyclePresentationGroup(canonicalStatus),
        agreedRateAmount: commercial.rates.get(row.id) ?? null,
        currency: row.currency ?? 'GBP',
        postingCompanyName: row.company_id ? companyNames.get(row.company_id) ?? null : null,
        awardedCarrierCompanyId: row.awarded_carrier_company_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }),
    commercialRatePartial: commercial.partial,
  });
}
