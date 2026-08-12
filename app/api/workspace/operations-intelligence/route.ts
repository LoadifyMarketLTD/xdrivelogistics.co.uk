import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ACTIVE_STATUSES = new Set([
  'awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded',
  'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
]);

const COMPANY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });

const text = (value: unknown) => typeof value === 'string' ? value : value == null ? null : String(value);

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : null;
};

const statusOf = (job: Record<string, unknown>) =>
  String(job.current_status ?? job.status ?? '').trim().toLowerCase();

const fullPostcode = (value: unknown) => {
  const normalized = String(value ?? '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const match = normalized.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  return match?.[1]?.replace(/\s+/g, '') ?? null;
};

async function geocodePostcodes(values: unknown[]) {
  const postcodes = [...new Set(values.map(fullPostcode).filter((value): value is string => Boolean(value)))].slice(0, 100);
  const result = new Map<string, { lat: number; lng: number }>();
  if (postcodes.length === 0) return result;

  try {
    const response = await fetch('https://api.postcodes.io/postcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postcodes }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return result;
    const payload = await response.json() as {
      result?: Array<{ query?: string; result?: { latitude?: number; longitude?: number } | null }>;
    };
    for (const item of payload.result ?? []) {
      const key = fullPostcode(item.query);
      const lat = numberValue(item.result?.latitude);
      const lng = numberValue(item.result?.longitude);
      if (key && lat !== null && lng !== null) result.set(key, { lat, lng });
    }
  } catch {
    // Best effort only. Operational data remains usable without postcode enrichment.
  }

  return result;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'Operations intelligence is temporarily unavailable.',
      context: 'workspace.operations-intelligence.config',
      retryable: true,
    });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Your session has expired. Sign in again.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Your session has expired. Sign in again.' });

  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  if (!COMPANY_ID_PATTERN.test(companyId)) return json(400, { error: 'A valid company workspace is required.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id, role_in_company, status, companies!inner(status)')
    .eq('company_id', companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .eq('companies.status', 'active')
    .maybeSingle();

  if (membershipError) {
    return operationalError({
      message: 'We could not verify access to this company workspace. Please retry.',
      context: `workspace.operations-intelligence.membership.company:${companyId}.user:${authData.user.id}`,
      cause: membershipError,
    });
  }
  if (!membership) return json(403, { error: 'You do not have access to this company workspace.' });

  const [driverBaseResult, futureResult, advertisingResult, jobsResult] = await Promise.all([
    supabaseAdmin.from('drivers').select('id').eq('company_id', companyId).limit(500),
    supabaseAdmin.from('drivers').select('id,future_position,future_position_date').eq('company_id', companyId).limit(500),
    supabaseAdmin.from('vehicles').select('id,assigned_driver_id,advertising_state').eq('company_id', companyId).limit(500),
    supabaseAdmin.from('jobs').select('*').or(`company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`).limit(500),
  ]);

  if (driverBaseResult.error) {
    return operationalError({
      message: 'Driver resource intelligence could not be loaded. Please retry.',
      context: `workspace.operations-intelligence.drivers.company:${companyId}`,
      cause: driverBaseResult.error,
    });
  }

  const driverIds = (driverBaseResult.data ?? []).map((row) => String(row.id)).filter(Boolean);
  const rawJobs = jobsResult.error ? [] : (jobsResult.data ?? []) as Array<Record<string, unknown>>;
  const activeJobs = rawJobs.filter((job) => ACTIVE_STATUSES.has(statusOf(job)));
  const activeJobIds = activeJobs.map((job) => text(job.id)).filter((value): value is string => Boolean(value));

  const [journeyResult, trackingResult] = await Promise.all([
    driverIds.length
      ? supabaseAdmin
          .from('return_journeys')
          .select('id,driver_id,from_postcode,to_postcode,available_from,available_to,status,created_at')
          .in('driver_id', driverIds)
          .in('status', ['available', 'active'])
          .order('available_from', { ascending: true })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
    activeJobIds.length
      ? supabaseAdmin
          .from('job_tracking_events')
          .select('*')
          .in('job_id', activeJobIds)
          .order('created_at', { ascending: false })
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const futureRows = futureResult.error ? [] : (futureResult.data ?? []).map((row) => ({
    id: String(row.id),
    futurePosition: text(row.future_position),
    futurePositionDate: text(row.future_position_date),
  }));

  const journeyRows = journeyResult.error ? [] : (journeyResult.data ?? []).map((row) => ({
    id: String(row.id),
    driverId: text(row.driver_id),
    fromPostcode: text(row.from_postcode),
    toPostcode: text(row.to_postcode),
    availableFrom: text(row.available_from),
    availableTo: text(row.available_to),
    status: text(row.status),
    createdAt: text(row.created_at),
  }));

  const geocoded = await geocodePostcodes([
    ...futureRows.map((row) => row.futurePosition),
    ...journeyRows.map((row) => row.fromPostcode),
  ]);

  const enrichedFutureRows = futureRows.map((row) => ({
    ...row,
    coordinates: row.futurePosition ? geocoded.get(fullPostcode(row.futurePosition) ?? '') ?? null : null,
  }));
  const enrichedJourneyRows = journeyRows.map((row) => ({
    ...row,
    fromCoordinates: row.fromPostcode ? geocoded.get(fullPostcode(row.fromPostcode) ?? '') ?? null : null,
  }));

  const advertisingRows = advertisingResult.error ? [] : (advertisingResult.data ?? []).map((row) => ({
    id: String(row.id),
    assignedDriverId: text(row.assigned_driver_id),
    advertisingState: text(row.advertising_state) ?? 'none',
  }));

  const jobDetails = activeJobs.map((job) => ({
    id: text(job.id),
    assignedDriverId: text(job.assigned_driver_id),
    status: text(job.current_status) ?? text(job.status),
    pickupTimeSlot: text(job.pickup_time_slot),
    deliveryTimeSlot: text(job.delivery_time_slot),
    pickupDateTime: text(job.pickup_datetime),
    deliveryDateTime: text(job.delivery_datetime),
    collectionContactName: text(job.collection_contact_name),
    collectionContactPhone: text(job.collection_contact_phone),
    deliveryContactName: text(job.delivery_contact_name),
    deliveryContactPhone: text(job.delivery_contact_phone),
    clientName: text(job.client_name),
    clientPhone: text(job.client_phone),
  }));

  const trackingEvents = trackingResult.error ? [] : ((trackingResult.data ?? []) as Array<Record<string, unknown>>).map((event) => ({
    id: text(event.id),
    jobId: text(event.job_id),
    eventType: text(event.event_type) ?? 'update',
    message: text(event.message) ?? text(event.note),
    meta: event.meta && typeof event.meta === 'object' && !Array.isArray(event.meta) ? event.meta : null,
    createdAt: text(event.created_at),
  }));

  const capabilities = {
    futurePositions: futureResult.error ? 'unavailable' : 'available',
    vehicleAdvertising: advertisingResult.error ? 'unavailable' : 'available',
    returnJourneys: journeyResult.error ? 'unavailable' : 'available',
    jobDetails: jobsResult.error ? 'unavailable' : 'available',
    trackingTimeline: trackingResult.error || jobsResult.error ? 'unavailable' : 'available',
  } as const;

  return json(200, {
    futurePositions: enrichedFutureRows,
    vehicleAdvertising: advertisingRows,
    returnJourneys: enrichedJourneyRows,
    jobDetails,
    trackingEvents,
    capabilities,
    partial: Object.values(capabilities).some((value) => value === 'unavailable'),
    generatedAt: new Date().toISOString(),
  });
}
