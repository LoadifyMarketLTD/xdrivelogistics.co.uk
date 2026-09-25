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
  const canViewCommercial = ['owner', 'admin', 'dispatcher'].includes(String(membership.role_in_company ?? '').toLowerCase());

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
  const scopedJobIds = rawJobs.map((job) => text(job.id)).filter((value): value is string => Boolean(value));
  const companyIds = [...new Set(rawJobs.flatMap((job) => [text(job.company_id), text(job.awarded_carrier_company_id), text(job.assigned_company_id)]).filter((value): value is string => Boolean(value)))];
  const vehicleIds = [...new Set(rawJobs.map((job) => text(job.vehicle_id)).filter((value): value is string => Boolean(value)))];

  const [journeyResult, trackingResult, agreementResult, companyResult, vehicleResult] = await Promise.all([
    driverIds.length
      ? supabaseAdmin
          .from('return_journeys')
          .select('id,driver_id,from_postcode,to_postcode,available_from,available_to,status,created_at')
          .in('driver_id', driverIds)
          .in('status', ['available', 'active'])
          .order('available_from', { ascending: true })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
    scopedJobIds.length
      ? supabaseAdmin
          .from('job_tracking_events')
          .select('*')
          .in('job_id', scopedJobIds)
          .order('created_at', { ascending: false })
          .limit(1500)
      : Promise.resolve({ data: [], error: null }),
    scopedJobIds.length
      ? supabaseAdmin
          .from('job_commercial_agreements')
          .select('job_id,agreed_amount,payment_terms,currency,created_at')
          .in('job_id', scopedJobIds)
          .order('created_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
    companyIds.length
      ? supabaseAdmin.from('companies').select('id,name,phone').in('id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length
      ? supabaseAdmin.from('vehicles').select('id,reg_plate').in('id', vehicleIds)
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

  const agreementByJob = new Map<string, Record<string, unknown>>();
  if (!agreementResult.error) {
    for (const row of (agreementResult.data ?? []) as Array<Record<string, unknown>>) {
      const jobId = text(row.job_id);
      if (jobId && !agreementByJob.has(jobId)) agreementByJob.set(jobId, row);
    }
  }
  const companyById = new Map<string, Record<string, unknown>>();
  if (!companyResult.error) {
    for (const row of (companyResult.data ?? []) as Array<Record<string, unknown>>) {
      const id = text(row.id);
      if (id) companyById.set(id, row);
    }
  }
  const vehicleById = new Map<string, Record<string, unknown>>();
  if (!vehicleResult.error) {
    for (const row of (vehicleResult.data ?? []) as Array<Record<string, unknown>>) {
      const id = text(row.id);
      if (id) vehicleById.set(id, row);
    }
  }

  const jobDetails = rawJobs.map((job) => {
    const jobId = text(job.id);
    const ownerCompanyId = text(job.company_id);
    const awardedCompanyId = text(job.awarded_carrier_company_id);
    const executionCompanyId = text(job.assigned_company_id);
    const ownerCompany = ownerCompanyId ? companyById.get(ownerCompanyId) ?? null : null;
    const awardedCompany = awardedCompanyId ? companyById.get(awardedCompanyId) ?? null : null;
    const executionCompany = executionCompanyId ? companyById.get(executionCompanyId) ?? null : null;
    const vehicleId = text(job.vehicle_id);
    const vehicle = vehicleId ? vehicleById.get(vehicleId) ?? null : null;
    const agreement = jobId ? agreementByJob.get(jobId) ?? null : null;
    const commercialVisible = canViewCommercial && (ownerCompanyId === companyId || awardedCompanyId === companyId);
    return {
      id: jobId,
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
      ownerCompanyName: text(ownerCompany?.name),
      ownerCompanyPhone: text(ownerCompany?.phone),
      awardedCompanyName: text(awardedCompany?.name),
      awardedCompanyPhone: text(awardedCompany?.phone),
      executionCompanyName: text(executionCompany?.name),
      vehicleRegistration: text(vehicle?.reg_plate),
      agreedRate: commercialVisible ? numberValue(agreement?.agreed_amount) ?? numberValue(job.agreed_rate_gbp) ?? numberValue(job.agreed_rate) : null,
      currency: commercialVisible ? text(agreement?.currency) ?? text(job.currency) ?? 'GBP' : null,
      paymentTerms: commercialVisible ? text(agreement?.payment_terms) ?? text(job.payment_terms) : null,
      driverNotes: text(job.driver_notes),
      deliveryNotes: text(job.delivery_notes),
      leftAt: text(job.left_at),
      deliveredAt: text(job.delivered_at),
      completedAt: text(job.completed_at),
      receivedBy: text(job.client_signature_name) ?? text(job.delivery_contact_name),
      itemCount: numberValue(job.no_of_items) ?? numberValue(job.items_count),
    };
  });

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
    commercialDetails: jobsResult.error || agreementResult.error || companyResult.error || vehicleResult.error ? 'unavailable' : 'available',
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
