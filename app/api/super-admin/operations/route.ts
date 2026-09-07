import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { coordinatesFromLocation } from '../../../../lib/geoLocation';
import { buildJobSearchPattern } from '../_lib/searchFilters';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const SEARCH_PAGE_SIZE = 1000;
const normalizeSearch = (raw: string) => raw.trim();

const pageParams = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  return { page, limit, offset: (page - 1) * limit };
};

const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

const loadMatchingJobIdsForColumn = async (
  column: 'pickup_location' | 'delivery_location' | 'pickup_postcode' | 'delivery_postcode',
  pattern: string,
) => {
  if (!supabaseAdmin) return { ids: [] as string[], error: 'Server auth is not configured.' };
  const ids: string[] = [];
  for (let offset = 0; ; offset += SEARCH_PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('jobs')
      .select('id')
      .ilike(column, pattern)
      .order('id', { ascending: true })
      .range(offset, offset + SEARCH_PAGE_SIZE - 1);
    if (result.error) return { ids: [] as string[], error: result.error.message };
    const page = (result.data ?? []).map((row) => String(row.id ?? '')).filter(Boolean);
    ids.push(...page);
    if (page.length < SEARCH_PAGE_SIZE) break;
  }
  return { ids, error: null as string | null };
};

const findMatchingJobIds = async (search: string) => {
  if (!supabaseAdmin || !search) return null;
  const pattern = buildJobSearchPattern(search);
  const results = await Promise.all([
    loadMatchingJobIdsForColumn('pickup_location', pattern),
    loadMatchingJobIdsForColumn('delivery_location', pattern),
    loadMatchingJobIdsForColumn('pickup_postcode', pattern),
    loadMatchingJobIdsForColumn('delivery_postcode', pattern),
  ]);
  const failed = results.find((result) => result.error);
  if (failed) return { error: failed.error as string };
  return { ids: Array.from(new Set(results.flatMap((result) => result.ids))) };
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

type CompanyRow = { id: string; name: string };
type DriverRow = { id: string; display_name: string | null; company_id: string | null; availability_status?: string | null };
type BidRow = { job_id: string };

const loadCompanyMap = async (companyIds: string[]) => {
  if (!supabaseAdmin || companyIds.length === 0) return { map: new Map<string, string>(), error: null as string | null };
  const { data, error } = await supabaseAdmin.from('companies').select('id, name').in('id', Array.from(new Set(companyIds)));
  if (error) return { map: new Map<string, string>(), error: error.message };
  return { map: new Map<string, string>(((data ?? []) as CompanyRow[]).map((row) => [row.id, row.name])), error: null as string | null };
};

const loadLatestLocations = async (driverIds: string[]) => {
  if (!supabaseAdmin) return { map: new Map<string, { id: string; recorded_at: string; location: unknown }>(), error: 'Server auth is not configured.' };
  const entries = await Promise.all(Array.from(new Set(driverIds)).map(async (driverId) => {
    const result = await supabaseAdmin!
      .from('driver_locations')
      .select('id, driver_id, recorded_at, location')
      .eq('driver_id', driverId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { driverId, data: result.data, error: result.error?.message ?? null };
  }));
  const failed = entries.find((entry) => entry.error);
  if (failed) return { map: new Map<string, { id: string; recorded_at: string; location: unknown }>(), error: failed.error as string };
  return {
    map: new Map(entries.flatMap((entry) => entry.data ? [[entry.driverId, entry.data as { id: string; recorded_at: string; location: unknown }] as const] : [])),
    error: null as string | null,
  };
};

const withCompanyAndDriverMaps = async (jobs: JobRow[]) => {
  if (!supabaseAdmin) return { error: 'Server auth is not configured.' } as const;
  const companyIds = Array.from(new Set(jobs.flatMap((job) => [job.company_id, job.awarded_carrier_company_id]).filter((value): value is string => Boolean(value))));
  const driverIds = Array.from(new Set(jobs.map((job) => job.assigned_driver_id).filter((value): value is string => Boolean(value))));
  const [companyResult, driversResult, bidCountsResult] = await Promise.all([
    loadCompanyMap(companyIds),
    driverIds.length > 0 ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds) : Promise.resolve({ data: [], error: null }),
    jobs.length > 0 ? supabaseAdmin.from('job_bids').select('job_id').in('job_id', jobs.map((job) => job.id)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (companyResult.error) return { error: companyResult.error } as const;
  if (driversResult.error) return { error: driversResult.error.message } as const;
  if (bidCountsResult.error) return { error: bidCountsResult.error.message } as const;
  const bidCountByJobId = new Map<string, number>();
  for (const row of (bidCountsResult.data ?? []) as BidRow[]) bidCountByJobId.set(row.job_id, (bidCountByJobId.get(row.job_id) ?? 0) + 1);
  return {
    companyNameById: companyResult.map,
    driverById: new Map<string, DriverRow>(((driversResult.data ?? []) as DriverRow[]).map((row) => [row.id, row])),
    bidCountByJobId,
  };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const { page, limit, offset } = pageParams(request);
  const search = normalizeSearch(searchParams.get('search') ?? '');

  if (section === 'quotes') {
    const { data: quotes, error, count } = await supabaseAdmin
      .from('quotes')
      .select('id, company_id, status, amount, currency, customer_name, pickup_location, delivery_location, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    if (typeof count !== 'number') return respond(500, { error: 'Quotes source returned an incomplete exact-count snapshot.' });
    const rows = quotes ?? [];
    const companyResult = await loadCompanyMap(rows.map((quote) => String(quote.company_id ?? '')).filter(Boolean));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    return respond(200, {
      section,
      rows: rows.map((quote) => ({ ...quote, company_name: companyResult.map.get(String(quote.company_id)) ?? 'Unknown company' })),
      pagination: pagination(page, limit, count),
    });
  }

  const supportedSections = ['jobs', 'allocations', 'deliveries', 'pods', 'active-jobs', 'pending-jobs', 'completed-jobs', 'driver-availability', 'fleet-positions', 'disputes'];
  if (!supportedSections.includes(section)) {
    return respond(400, { error: 'Invalid section. Use jobs, quotes, allocations, deliveries, pods, active-jobs, pending-jobs, completed-jobs, driver-availability, fleet-positions, or disputes.' });
  }

  if (section === 'driver-availability' || section === 'fleet-positions') {
    const { data: drivers, error: driversError, count } = await supabaseAdmin
      .from('drivers')
      .select('id, display_name, company_id, availability_status', { count: 'exact' })
      .order('display_name', { ascending: true })
      .range(offset, offset + limit - 1);
    if (driversError) return respond(500, { error: driversError.message });
    if (typeof count !== 'number') return respond(500, { error: 'Driver availability source returned an incomplete exact-count snapshot.' });
    const typedDrivers = (drivers ?? []) as DriverRow[];
    const [locationsResult, companyResult] = await Promise.all([
      loadLatestLocations(typedDrivers.map((driver) => driver.id)),
      loadCompanyMap(typedDrivers.map((driver) => driver.company_id).filter((value): value is string => Boolean(value))),
    ]);
    if (locationsResult.error) return respond(500, { error: locationsResult.error });
    if (companyResult.error) return respond(500, { error: companyResult.error });

    if (section === 'driver-availability') {
      return respond(200, {
        section,
        rows: typedDrivers.map((driver) => {
          const location = locationsResult.map.get(driver.id) ?? null;
          const coordinates = coordinatesFromLocation(location?.location);
          return {
            id: driver.id,
            display_name: driver.display_name ?? 'Unknown driver',
            company_name: driver.company_id ? companyResult.map.get(driver.company_id) ?? 'Unknown company' : '—',
            availability_status: driver.availability_status ?? 'unknown',
            last_seen_at: location?.recorded_at ?? null,
            last_lat: coordinates.lat,
            last_lng: coordinates.lng,
          };
        }),
        pagination: pagination(page, limit, count),
      });
    }

    return respond(200, {
      section,
      rows: typedDrivers.map((driver) => {
        const location = locationsResult.map.get(driver.id) ?? null;
        const coordinates = coordinatesFromLocation(location?.location);
        return {
          id: location?.id ?? driver.id,
          driver_id: driver.id,
          driver_name: driver.display_name ?? 'Unknown driver',
          availability_status: driver.availability_status ?? 'unknown',
          company_name: driver.company_id ? companyResult.map.get(driver.company_id) ?? 'Unknown company' : '—',
          lat: coordinates.lat,
          lng: coordinates.lng,
          heading: null,
          speed_mph: null,
          recorded_at: location?.recorded_at ?? null,
        };
      }),
      pagination: pagination(page, limit, count),
    });
  }

  if (section === 'disputes') {
    const { data: disputes, error: disputesError, count } = await supabaseAdmin
      .from('job_disputes')
      .select('id, job_id, raised_by_company_id, status, description, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (disputesError) return respond(500, { error: disputesError.message });
    if (typeof count !== 'number') return respond(500, { error: 'Disputes source returned an incomplete exact-count snapshot.' });
    const rows = disputes ?? [];
    const jobIds = Array.from(new Set(rows.map((row) => String(row.job_id ?? '')).filter(Boolean)));
    const companyIds = Array.from(new Set(rows.map((row) => String(row.raised_by_company_id ?? '')).filter(Boolean)));
    const [jobsResult, companyResult] = await Promise.all([
      jobIds.length ? supabaseAdmin.from('jobs').select('id, status, pickup_location, delivery_location').in('id', jobIds) : Promise.resolve({ data: [], error: null }),
      loadCompanyMap(companyIds),
    ]);
    if (jobsResult.error) return respond(500, { error: jobsResult.error.message });
    if (companyResult.error) return respond(500, { error: companyResult.error });
    const jobById = new Map((jobsResult.data ?? []).map((job) => [String(job.id), job]));
    return respond(200, {
      section,
      rows: rows.map((dispute) => {
        const job = jobById.get(String(dispute.job_id)) as { status?: string; pickup_location?: string | null; delivery_location?: string | null } | undefined;
        return {
          id: dispute.id,
          job_id: dispute.job_id,
          status: dispute.status,
          description: dispute.description ?? '—',
          raised_by: companyResult.map.get(String(dispute.raised_by_company_id)) ?? 'Unknown company',
          job_status: job?.status ?? '—',
          pickup_location: job?.pickup_location ?? null,
          delivery_location: job?.delivery_location ?? null,
          created_at: dispute.created_at,
        };
      }),
      pagination: pagination(page, limit, count),
    });
  }

  const searchMatches = search ? await findMatchingJobIds(search) : null;
  if (searchMatches && 'error' in searchMatches) return respond(500, { error: searchMatches.error });
  if (searchMatches && searchMatches.ids.length === 0) {
    return respond(200, { section, pagination: pagination(page, limit, 0), rows: [] });
  }

  let query = supabaseAdmin
    .from('jobs')
    .select('id, status, company_id, assigned_driver_id, created_at, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, awarded_carrier_company_id, delivery_photos, delivery_signature_data', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (section === 'allocations') query = query.not('assigned_driver_id', 'is', null);
  if (section === 'deliveries') query = query.in('status', ['allocated', 'accepted', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery', 'delivered']);
  if (section === 'active-jobs') query = query.in('status', ['allocated', 'accepted', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
  if (section === 'pending-jobs') query = query.in('status', ['posted', 'quoted', 'awarded']);
  if (section === 'completed-jobs') query = query.in('status', ['delivered', 'invoiced', 'paid']);
  if (section === 'pods') query = query.or('delivery_signature_data.not.is.null,delivery_photos.not.is.null');
  if (searchMatches && 'ids' in searchMatches) query = query.in('id', searchMatches.ids);
  query = query.range(offset, offset + limit - 1);

  const { data: jobs, error: jobsError, count } = await query;
  if (jobsError) return respond(500, { error: jobsError.message });
  if (typeof count !== 'number') return respond(500, { error: 'Jobs source returned an incomplete exact-count snapshot.' });

  const mappedResources = await withCompanyAndDriverMaps((jobs ?? []) as JobRow[]);
  if ('error' in mappedResources) return respond(500, { error: mappedResources.error });
  const { companyNameById, driverById, bidCountByJobId } = mappedResources;

  return respond(200, {
    section,
    pagination: pagination(page, limit, count),
    rows: ((jobs ?? []) as JobRow[]).map((job) => {
      const assignedDriver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) ?? null : null;
      return {
        ...job,
        posting_company_name: companyNameById.get(job.company_id) ?? 'Unknown company',
        awarded_company_name: job.awarded_carrier_company_id ? companyNameById.get(job.awarded_carrier_company_id) ?? 'Unknown company' : null,
        assigned_driver_name: assignedDriver?.display_name ?? null,
        assigned_driver_company_name: assignedDriver?.company_id ? companyNameById.get(assignedDriver.company_id) ?? null : null,
        bids_count: bidCountByJobId.get(job.id) ?? 0,
        pod_photos_count: Array.isArray(job.delivery_photos) ? job.delivery_photos.length : 0,
        pod_signature_present: Boolean(job.delivery_signature_data),
      };
    }),
  });
}
