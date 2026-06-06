import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const resolveOwnerProfile = async (authUserId: string) => {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
};

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return null;
  const profile = await resolveOwnerProfile(authData.user.id);
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

type JobRow = {
  id: string;
  status: string;
  company_id: string;
  assigned_driver_id: string | null;
  created_at: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  awarded_carrier_company_id: string | null;
  delivery_photos: string[] | null;
  delivery_signature_data: string | null;
};

type QuoteRow = {
  id: string;
  company_id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  customer_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  created_at: string;
};

type DriverRow = {
  id: string;
  display_name: string | null;
  company_id: string;
};

type CompanyRow = { id: string; name: string };
type BidRow = { job_id: string };

const withCompanyAndDriverMaps = async (jobs: JobRow[]) => {
  const companyIds = Array.from(new Set(jobs.flatMap((job) => [job.company_id, job.awarded_carrier_company_id]).filter((v): v is string => Boolean(v))));
  const driverIds = Array.from(new Set(jobs.map((job) => job.assigned_driver_id).filter((v): v is string => Boolean(v))));

  const [companiesResult, driversResult, bidCountsResult] = await Promise.all([
    companyIds.length > 0
      ? supabaseAdmin!.from('companies').select('id, name').in('id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    driverIds.length > 0
      ? supabaseAdmin!.from('drivers').select('id, display_name, company_id').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    jobs.length > 0
      ? supabaseAdmin!.from('job_bids').select('job_id').in('job_id', jobs.map((job) => job.id))
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (companiesResult.error) return { error: companiesResult.error.message };
  if (driversResult.error) return { error: driversResult.error.message };
  if (bidCountsResult.error) return { error: bidCountsResult.error.message };

  return {
    companyNameById: new Map<string, string>((companiesResult.data as CompanyRow[]).map((row) => [row.id, row.name])),
    driverById: new Map<string, DriverRow>((driversResult.data as DriverRow[]).map((row) => [row.id, row])),
    bidCountByJobId: (() => {
      const map = new Map<string, number>();
      for (const row of (bidCountsResult.data as BidRow[])) {
        map.set(row.job_id, (map.get(row.job_id) ?? 0) + 1);
      }
      return map;
    })(),
  };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) {
    return respond(403, { error: 'Forbidden: owner role required.' });
  }

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

  if (section === 'quotes') {
    const { data: quotes, error } = await supabaseAdmin
      .from('quotes')
      .select('id, company_id, status, amount, currency, customer_name, pickup_location, delivery_location, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return respond(500, { error: error.message });
    }

    const companyIds = Array.from(new Set((quotes ?? []).map((quote) => quote.company_id).filter(Boolean)));
    const { data: companies, error: companiesError } = companyIds.length > 0
      ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
      : { data: [], error: null };

    if (companiesError) {
      return respond(500, { error: companiesError.message });
    }

    const companyNameById = new Map<string, string>((companies as CompanyRow[]).map((row) => [row.id, row.name]));

    return respond(200, {
      section,
      rows: (quotes as QuoteRow[]).map((quote) => ({
        ...quote,
        company_name: companyNameById.get(quote.company_id) ?? 'Unknown company',
      })),
    });
  }

  if (!['jobs', 'allocations', 'deliveries', 'pods'].includes(section)) {
    return respond(400, { error: 'Invalid section. Use jobs, quotes, allocations, deliveries, or pods.' });
  }

  let query = supabaseAdmin
    .from('jobs')
    .select('id, status, company_id, assigned_driver_id, created_at, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, awarded_carrier_company_id, delivery_photos, delivery_signature_data')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (section === 'allocations') {
    query = query.not('assigned_driver_id', 'is', null);
  }

  if (section === 'deliveries') {
    query = query.in('status', ['allocated', 'in_transit', 'delivered']);
  }

  if (section === 'pods') {
    query = query.or('delivery_signature_data.not.is.null,delivery_photos.not.is.null');
  }

  const { data: jobs, error: jobsError } = await query;

  if (jobsError) {
    return respond(500, { error: jobsError.message });
  }

  const mappedResources = await withCompanyAndDriverMaps((jobs ?? []) as JobRow[]);
  if ('error' in mappedResources) {
    return respond(500, { error: mappedResources.error });
  }

  const { companyNameById, driverById, bidCountByJobId } = mappedResources;

  return respond(200, {
    section,
    rows: ((jobs ?? []) as JobRow[]).map((job) => {
      const assignedDriver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) ?? null : null;
      const podPhotosCount = Array.isArray(job.delivery_photos) ? job.delivery_photos.length : 0;
      const hasSignature = Boolean(job.delivery_signature_data);
      return {
        ...job,
        posting_company_name: companyNameById.get(job.company_id) ?? 'Unknown company',
        awarded_company_name: job.awarded_carrier_company_id
          ? (companyNameById.get(job.awarded_carrier_company_id) ?? 'Unknown company')
          : null,
        assigned_driver_name: assignedDriver?.display_name ?? null,
        assigned_driver_company_name: assignedDriver ? companyNameById.get(assignedDriver.company_id) ?? null : null,
        bids_count: bidCountByJobId.get(job.id) ?? 0,
        pod_photos_count: podPhotosCount,
        pod_signature_present: hasSignature,
      };
    }),
  });
}
