import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { coordinatesFromLocation } from '../../../../lib/geoLocation';
import { buildJobSearchPattern } from '../_lib/searchFilters';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const normalizeSearch = (raw: string) => raw.trim();

const findMatchingJobIds = async (search: string) => {
  if (!supabaseAdmin || !search) return null;
  const pattern = buildJobSearchPattern(search);
  const [pickupLocationResult, deliveryLocationResult, pickupPostcodeResult, deliveryPostcodeResult] = await Promise.all([
    supabaseAdmin.from('jobs').select('id').ilike('pickup_location', pattern).limit(500),
    supabaseAdmin.from('jobs').select('id').ilike('delivery_location', pattern).limit(500),
    supabaseAdmin.from('jobs').select('id').ilike('pickup_postcode', pattern).limit(500),
    supabaseAdmin.from('jobs').select('id').ilike('delivery_postcode', pattern).limit(500),
  ]);
  const firstError = [pickupLocationResult.error, deliveryLocationResult.error, pickupPostcodeResult.error, deliveryPostcodeResult.error].find(Boolean);
  if (firstError) return { error: firstError.message };
  return {
    ids: Array.from(
      new Set(
        [pickupLocationResult.data, deliveryLocationResult.data, pickupPostcodeResult.data, deliveryPostcodeResult.data]
          .flatMap((rows) => rows ?? [])
          .map((row) => String(row.id ?? ''))
          .filter(Boolean),
      ),
    ),
  };
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
      for (const row of bidCountsResult.data as BidRow[]) {
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

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limitParam = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  const offset = (pageParam - 1) * limitParam;
  const search = normalizeSearch(searchParams.get('search') ?? '');
  const searchMatches = search ? await findMatchingJobIds(search) : null;
  if (searchMatches && 'error' in searchMatches) return respond(500, { error: searchMatches.error });
  const legacyLimit = Math.min(Number(searchParams.get('limit') ?? limitParam) || limitParam, 500);

  if (section === 'quotes') {
    const { data: quotes, error } = await supabaseAdmin
      .from('quotes')
      .select('id, company_id, status, amount, currency, customer_name, pickup_location, delivery_location, created_at')
      .order('created_at', { ascending: false })
      .limit(legacyLimit);

    if (error) return respond(500, { error: error.message });

    const companyIds = Array.from(new Set((quotes ?? []).map((quote) => quote.company_id).filter(Boolean)));
    const { data: companies, error: companiesError } = companyIds.length > 0
      ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
      : { data: [], error: null };

    if (companiesError) return respond(500, { error: companiesError.message });

    const companyNameById = new Map<string, string>((companies as CompanyRow[]).map((row) => [row.id, row.name]));

    return respond(200, {
      section,
      rows: (quotes as QuoteRow[]).map((quote) => ({
        ...quote,
        company_name: companyNameById.get(quote.company_id) ?? 'Unknown company',
      })),
    });
  }

  if (!['jobs', 'allocations', 'deliveries', 'pods', 'active-jobs', 'pending-jobs', 'completed-jobs', 'driver-availability', 'fleet-positions', 'disputes'].includes(section)) {
    return respond(400, { error: 'Invalid section. Use jobs, quotes, allocations, deliveries, pods, active-jobs, pending-jobs, completed-jobs, driver-availability, fleet-positions, or disputes.' });
  }

  if (section === 'driver-availability') {
    const { data: drivers, error: driversError } = await supabaseAdmin
      .from('drivers')
      .select('id, display_name, company_id, availability_status')
      .order('display_name', { ascending: true })
      .limit(legacyLimit);

    if (driversError) return respond(500, { error: driversError.message });

    const driverIds = (drivers ?? []).map((d) => d.id as string);
    const companyIds = Array.from(new Set((drivers ?? []).map((d) => d.company_id as string).filter(Boolean)));

    const [locResult, compResult] = await Promise.all([
      driverIds.length > 0
        ? supabaseAdmin
            .from('driver_locations')
            .select('driver_id, recorded_at, location')
            .in('driver_id', driverIds)
            .order('recorded_at', { ascending: false })
            .limit(driverIds.length * 3)
        : Promise.resolve({ data: [], error: null }),
      companyIds.length > 0
        ? supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (locResult.error) return respond(500, { error: locResult.error.message });
    if (compResult.error) return respond(500, { error: compResult.error.message });

    const latestLocByDriver = new Map<string, { recorded_at: string; lat: number | null; lng: number | null }>();
    for (const loc of (locResult.data ?? []) as Array<{ driver_id: string; recorded_at: string; location: unknown }>) {
      if (!latestLocByDriver.has(loc.driver_id)) {
        const coordinates = coordinatesFromLocation(loc.location);
        latestLocByDriver.set(loc.driver_id, { recorded_at: loc.recorded_at, lat: coordinates.lat, lng: coordinates.lng });
      }
    }

    const companyNameById = new Map<string, string>((compResult.data as CompanyRow[]).map((c) => [c.id, c.name]));

    return respond(200, {
      section,
      rows: (drivers as Array<{ id: string; display_name: string | null; company_id: string; availability_status: string | null }>).map((d) => {
        const loc = latestLocByDriver.get(d.id) ?? null;
        return {
          id: d.id,
          display_name: d.display_name ?? 'Unknown driver',
          company_name: companyNameById.get(d.company_id) ?? 'Unknown company',
          availability_status: d.availability_status ?? 'offline',
          last_seen_at: loc?.recorded_at ?? null,
          last_lat: loc?.lat ?? null,
          last_lng: loc?.lng ?? null,
        };
      }),
    });
  }

  if (section === 'disputes') {
    const { data: disputes, error: disputesError } = await supabaseAdmin
      .from('job_disputes')
      .select('id, job_id, raised_by_company_id, status, description, created_at')
      .order('created_at', { ascending: false })
      .limit(legacyLimit);

    if (disputesError) return respond(500, { error: disputesError.message });

    const jobIds = Array.from(new Set((disputes ?? []).map((d) => d.job_id as string).filter(Boolean)));
    const compIds = Array.from(new Set((disputes ?? []).map((d) => d.raised_by_company_id as string).filter(Boolean)));

    const [jobsResult, compsResult] = await Promise.all([
      jobIds.length > 0
        ? supabaseAdmin.from('jobs').select('id, status, pickup_location, delivery_location').in('id', jobIds)
        : Promise.resolve({ data: [], error: null }),
      compIds.length > 0
        ? supabaseAdmin.from('companies').select('id, name').in('id', compIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (jobsResult.error) return respond(500, { error: jobsResult.error.message });
    if (compsResult.error) return respond(500, { error: compsResult.error.message });

    const jobById = new Map<string, { status: string; pickup_location: string | null; delivery_location: string | null }>(
      (jobsResult.data as Array<{ id: string; status: string; pickup_location: string | null; delivery_location: string | null }>)
        .map((j) => [j.id, j]),
    );
    const companyNameById = new Map<string, string>((compsResult.data as CompanyRow[]).map((c) => [c.id, c.name]));

    return respond(200, {
      section,
      rows: (disputes as Array<{ id: string; job_id: string; raised_by_company_id: string; status: string; description: string | null; created_at: string }>).map((d) => {
        const job = jobById.get(d.job_id) ?? null;
        return {
          id: d.id,
          job_id: d.job_id,
          status: d.status,
          description: d.description ?? '—',
          raised_by: companyNameById.get(d.raised_by_company_id) ?? 'Unknown company',
          job_status: job?.status ?? '—',
          pickup_location: job?.pickup_location ?? null,
          delivery_location: job?.delivery_location ?? null,
          created_at: d.created_at,
        };
      }),
    });
  }

  if (section === 'fleet-positions') {
    const { data: latestLocs, error: locsError } = await supabaseAdmin
      .from('driver_locations')
      .select('id, driver_id, location, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(legacyLimit);

    if (locsError) return respond(500, { error: locsError.message });

    const seen = new Set<string>();
    const deduped = (latestLocs ?? []).filter((row) => {
      if (seen.has(row.driver_id as string)) return false;
      seen.add(row.driver_id as string);
      return true;
    });

    const driverIds = deduped.map((r) => r.driver_id as string);

    const drvResult = driverIds.length > 0
      ? await supabaseAdmin
          .from('drivers')
          .select('id, display_name, availability_status, company_id')
          .in('id', driverIds)
      : { data: [], error: null };

    if (drvResult.error) return respond(500, { error: drvResult.error.message });

    const companyIds = Array.from(
      new Set(
        ((drvResult.data ?? []) as Array<{ company_id: string | null }>)
          .map((d) => d.company_id)
          .filter((v): v is string => Boolean(v))
      )
    );

    const compResult2 = companyIds.length > 0
      ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
      : { data: [], error: null };

    if (compResult2.error) return respond(500, { error: compResult2.error.message });

    const driverInfoById = new Map<string, { display_name: string | null; availability_status: string | null; company_id: string | null }>(
      (drvResult.data as Array<{ id: string; display_name: string | null; availability_status: string | null; company_id: string | null }>)
        .map((d) => [d.id, d]),
    );
    const companyNameById2 = new Map<string, string>((compResult2.data as CompanyRow[]).map((c) => [c.id, c.name]));

    return respond(200, {
      section,
      rows: deduped.map((loc) => {
        const drv = driverInfoById.get(loc.driver_id as string) ?? null;
        const coordinates = coordinatesFromLocation((loc as { location: unknown }).location);
        return {
          id: loc.id,
          driver_id: loc.driver_id,
          driver_name: drv?.display_name ?? 'Unknown driver',
          availability_status: drv?.availability_status ?? 'offline',
          company_name: drv?.company_id ? (companyNameById2.get(drv.company_id) ?? 'Unknown company') : 'Unknown company',
          lat: coordinates.lat,
          lng: coordinates.lng,
          heading: null,
          speed_mph: null,
          recorded_at: loc.recorded_at,
        };
      }),
    });
  }

  let query = supabaseAdmin
    .from('jobs')
    .select('id, status, company_id, assigned_driver_id, created_at, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, awarded_carrier_company_id, delivery_photos, delivery_signature_data', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (section === 'allocations') query = query.not('assigned_driver_id', 'is', null);
  if (section === 'deliveries') query = query.in('status', ['allocated', 'collected', 'in_transit', 'delivered']);
  if (section === 'active-jobs') query = query.in('status', ['allocated', 'collected', 'in_transit']);
  if (section === 'pending-jobs') query = query.in('status', ['posted', 'quoted', 'awarded']);
  if (section === 'completed-jobs') query = query.in('status', ['delivered', 'invoiced', 'paid']);
  if (section === 'pods') query = query.or('delivery_signature_data.not.is.null,delivery_photos.not.is.null');

  if (searchMatches && searchMatches.ids.length === 0) {
    return respond(200, {
      section,
      pagination: {
        page: pageParam,
        limit: limitParam,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: pageParam > 1,
      },
      rows: [],
    });
  }

  if (searchMatches && 'ids' in searchMatches) query = query.in('id', searchMatches.ids);
  query = query.range(offset, offset + limitParam - 1);

  const { data: jobs, error: jobsError, count: jobsCount } = await query;
  if (jobsError) return respond(500, { error: jobsError.message });

  const mappedResources = await withCompanyAndDriverMaps((jobs ?? []) as JobRow[]);
  if ('error' in mappedResources) return respond(500, { error: mappedResources.error });

  const { companyNameById, driverById, bidCountByJobId } = mappedResources;
  const totalCount = jobsCount ?? (jobs ?? []).length;
  const totalPages = Math.ceil(totalCount / limitParam);

  return respond(200, {
    section,
    pagination: {
      page: pageParam,
      limit: limitParam,
      total: totalCount,
      totalPages,
      hasNextPage: pageParam < totalPages,
      hasPrevPage: pageParam > 1,
    },
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
