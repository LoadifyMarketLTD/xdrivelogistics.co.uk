import { NextRequest, NextResponse } from 'next/server';

import { resolveDriverOperationalEligibility } from '../../driver/_lib/operationalEligibility';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { deriveSecureLoadIntelligence } from '../_lib/secureLoadIntelligence';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const MAX_PAGE_SIZE = 50;

type JobRow = {
  id: string;
  status: string | null;
  current_status: string | null;
  company_id: string | null;
  posted_by_company_id: string | null;
  awarded_carrier_company_id: string | null;
  assigned_driver_id: string | null;
  vehicle_id: string | null;
  load_ref: string | null;
  load_id: string | null;
  load_reference: string | null;
  booking_reference: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  requested_vehicle_label: string | null;
  requested_vehicle_type: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  weight_kg: number | null;
  pallets: number | null;
  cargo_value_gbp: number | null;
  special_requirements: string | null;
  document_checklist: string[] | null;
  direct_delivery_required: boolean | null;
  pod_required: boolean | null;
  pod_generated: boolean | null;
  pod_generated_at: string | null;
  delivery_signature_data: unknown;
  delivery_photos: unknown;
  pod_photos: unknown;
  hard_copy_pod: string | null;
  exchange_visibility: string | null;
  created_at: string;
  updated_at: string;
};

type CompanyRow = { id: string; name: string | null; trading_name?: string | null };

type TrackingResult = {
  jobId: string;
  recordedAt: string | null;
  error: { message: string } | null;
};

const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

const referenceOf = (job: JobRow) =>
  job.load_ref ?? job.load_id ?? job.load_reference ?? job.booking_reference ?? job.id;

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  if (!(await verifyPlatformOwner(request))) {
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  const admin = supabaseAdmin;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(searchParams.get('limit') ?? '25') || 25));
  const offset = (page - 1) * limit;

  const { data, error, count } = await admin
    .from('jobs')
    .select('id,status,current_status,company_id,posted_by_company_id,awarded_carrier_company_id,assigned_driver_id,vehicle_id,load_ref,load_id,load_reference,booking_reference,pickup_location,pickup_postcode,delivery_location,delivery_postcode,pickup_datetime,delivery_datetime,requested_vehicle_label,requested_vehicle_type,vehicle_type,cargo_type,requested_cargo_label,weight_kg,pallets,cargo_value_gbp,special_requirements,document_checklist,direct_delivery_required,pod_required,pod_generated,pod_generated_at,delivery_signature_data,delivery_photos,pod_photos,hard_copy_pod,exchange_visibility,created_at,updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return respond(500, { error: error.message });
  if (typeof count !== 'number') {
    return respond(500, { error: 'Secure Load source returned an incomplete exact-count snapshot.' });
  }

  const jobs = (data ?? []) as JobRow[];
  const jobIds = jobs.map((job) => job.id);
  const companyIds = Array.from(new Set(jobs.flatMap((job) => [
    job.company_id,
    job.posted_by_company_id,
    job.awarded_carrier_company_id,
  ]).filter((id): id is string => Boolean(id))));
  const driverIds = Array.from(new Set(
    jobs.map((job) => job.assigned_driver_id).filter((id): id is string => Boolean(id)),
  ));

  const [companiesResult, documentsResult, trackingResults] = await Promise.all([
    companyIds.length
      ? admin.from('companies').select('id,name,trading_name').in('id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? admin.from('job_documents').select('job_id').in('job_id', jobIds)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(jobIds.map(async (jobId): Promise<TrackingResult> => {
      const result = await admin
        .from('driver_locations')
        .select('job_id,recorded_at')
        .eq('job_id', jobId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        jobId,
        recordedAt: result.data?.recorded_at ? String(result.data.recorded_at) : null,
        error: result.error ? { message: result.error.message } : null,
      };
    })),
  ]);

  if (companiesResult.error) return respond(500, { error: companiesResult.error.message });
  if (documentsResult.error) return respond(500, { error: documentsResult.error.message });
  const trackingFailure = trackingResults.find((entry) => entry.error);
  if (trackingFailure?.error) return respond(500, { error: trackingFailure.error.message });

  const companyById = new Map<string, string>();
  for (const company of (companiesResult.data ?? []) as CompanyRow[]) {
    companyById.set(company.id, company.trading_name ?? company.name ?? 'Unknown company');
  }

  const documentsByJob = new Map<string, number>();
  for (const row of documentsResult.data ?? []) {
    const jobId = String(row.job_id ?? '');
    if (jobId) documentsByJob.set(jobId, (documentsByJob.get(jobId) ?? 0) + 1);
  }
  const trackingByJob = new Map(
    trackingResults.filter((entry) => entry.recordedAt).map((entry) => [entry.jobId, entry.recordedAt as string]),
  );

  const eligibilityByDriver = new Map<
    string,
    Awaited<ReturnType<typeof resolveDriverOperationalEligibility>> | null
  >();
  const unavailableDrivers = new Set<string>();
  await Promise.all(driverIds.map(async (driverId) => {
    try {
      eligibilityByDriver.set(driverId, await resolveDriverOperationalEligibility(admin, driverId));
    } catch {
      eligibilityByDriver.set(driverId, null);
      unavailableDrivers.add(driverId);
    }
  }));

  const rows = jobs.map((job) => {
    const driverId = job.assigned_driver_id;
    const eligibility = driverId ? eligibilityByDriver.get(driverId) ?? null : null;
    const intelligence = deriveSecureLoadIntelligence(
      job,
      eligibility,
      Boolean(driverId && unavailableDrivers.has(driverId)),
      trackingByJob.has(job.id),
      documentsByJob.get(job.id) ?? 0,
    );
    const postingCompanyId = job.posted_by_company_id ?? job.company_id;
    return {
      id: job.id,
      reference: referenceOf(job),
      status: job.current_status ?? job.status ?? 'unknown',
      posting_company_id: postingCompanyId,
      posting_company_name: postingCompanyId ? companyById.get(postingCompanyId) ?? 'Unknown company' : 'Unknown company',
      awarded_company_id: job.awarded_carrier_company_id,
      awarded_company_name: job.awarded_carrier_company_id
        ? companyById.get(job.awarded_carrier_company_id) ?? 'Unknown company'
        : null,
      pickup_location: job.pickup_location,
      pickup_postcode: job.pickup_postcode,
      delivery_location: job.delivery_location,
      delivery_postcode: job.delivery_postcode,
      pickup_datetime: job.pickup_datetime,
      delivery_datetime: job.delivery_datetime,
      requested_vehicle: job.requested_vehicle_label ?? job.requested_vehicle_type ?? job.vehicle_type,
      cargo: job.requested_cargo_label ?? job.cargo_type,
      assigned_driver_id: job.assigned_driver_id,
      vehicle_id: job.vehicle_id,
      exchange_visibility: job.exchange_visibility,
      tracking_recorded_at: trackingByJob.get(job.id) ?? null,
      created_at: job.created_at,
      ...intelligence,
    };
  });

  const countState = (state: string) => rows.filter((row) => row.state === state).length;
  return respond(200, {
    section: 'secure-loads',
    refreshedAt: new Date().toISOString(),
    rows,
    summary: {
      total_records: count,
      page_records: rows.length,
      blocked_on_page: countState('blocked'),
      review_on_page: countState('review'),
      awaiting_assignment_on_page: countState('awaiting_assignment'),
      clear_on_page: countState('clear'),
    },
    definitions: {
      total_records: 'Exact platform job count returned by the canonical jobs query.',
      attention_counts: 'Blocked, review, awaiting-assignment and clear counts apply only to the current page.',
      secure_load: 'Read-only derived intelligence. It does not mutate jobs, compliance, payments or company access.',
    },
    note: 'Secure Load is a read-only, fail-closed intelligence view. Attention counts other than total_records are scoped to the current page.',
    pagination: pagination(page, limit, count),
  });
}
