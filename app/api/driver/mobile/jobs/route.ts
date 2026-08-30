import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../_lib/platformFlags';
import { driverJobStatusesForScope } from '../../../../../lib/jobs/jobLifecyclePresentation';
import { loadDriverAgreedRates } from '../../_lib/commercialRate';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond, toMoney } from '../_lib';
import { buildSignedJobAttachments } from '../jobAttachmentPresentation';
import { buildJobOperationalPresentation, driverJobOperationalSelect } from '../jobOperationalPresentation';
import { buildSignedPodPresentations } from '../podPresentation';

type MobileJobWithPresentation = MobileJobRow & Record<string, unknown> & {
  damage_photos?: unknown;
  pod_generated_at?: string | null;
  driver_notes?: string | null;
};

function validIsoDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type JobStopRow = {
  id: string;
  job_id: string;
  sequence: number;
  stop_type: 'collection' | 'delivery';
  address: string;
  postcode: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  window_start: string | null;
  window_end: string | null;
  instructions: string | null;
  status: string | null;
  arrived_at: string | null;
  completed_at: string | null;
};

function mapStop(stop: JobStopRow) {
  return {
    id: stop.id,
    type: stop.stop_type,
    sequence: stop.sequence,
    address: [stop.address, stop.postcode].filter(Boolean).join(', '),
    company: stop.company_name ?? undefined,
    contactPerson: stop.contact_name ?? undefined,
    telephone: stop.contact_phone ?? undefined,
    timeWindowFrom: stop.window_start ?? undefined,
    timeWindowTo: stop.window_end ?? undefined,
    status: stop.status ?? 'pending',
    notes: stop.instructions ?? undefined,
    arrivedAt: stop.arrived_at ?? undefined,
    completedAt: stop.completed_at ?? undefined,
  };
}

async function loadStops(jobIds: string[]) {
  const stopsByJob = new Map<string, ReturnType<typeof mapStop>[]>();
  if (!supabaseAdmin || jobIds.length === 0) return { stopsByJob, partial: false };

  const { data, error } = await supabaseAdmin
    .from('job_stops')
    .select('id, job_id, sequence, stop_type, address, postcode, company_name, contact_name, contact_phone, window_start, window_end, instructions, status, arrived_at, completed_at')
    .in('job_id', jobIds)
    .order('sequence', { ascending: true });

  if (error) {
    return { stopsByJob, partial: true };
  }

  for (const row of (data ?? []) as unknown as JobStopRow[]) {
    const list = stopsByJob.get(row.job_id) ?? [];
    list.push(mapStop(row));
    stopsByJob.set(row.job_id, list);
  }
  return { stopsByJob, partial: false };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'active';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100) || 100, 1), 250);
  const statusList = driverJobStatusesForScope(scope);
  const completedHistory = scope === 'completed';
  const requestedHistoryDays = Number(searchParams.get('historyDays') ?? 365);
  const historyDays = completedHistory
    ? Math.min(365, Math.max(1, Number.isFinite(requestedHistoryDays) ? Math.round(requestedHistoryDays) : 365))
    : null;
  const cursor = completedHistory ? validIsoDate(searchParams.get('cursor')) : null;

  let query = supabaseAdmin
    .from('jobs')
    .select(`${jobSelect},damage_photos,pod_generated_at,driver_notes,${driverJobOperationalSelect}`)
    .eq('assigned_driver_id', driver.driverId)
    .order(completedHistory ? 'updated_at' : 'pickup_datetime', { ascending: !completedHistory })
    .limit(limit);

  if (completedHistory && historyDays !== null) {
    const since = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('updated_at', since);
    if (cursor) query = query.lt('updated_at', cursor);
  }

  if (statusList) {
    const statuses = statusList.join(',');
    query = query.or(`current_status.in.(${statuses}),and(current_status.is.null,status.in.(${statuses}))`);
  }

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  const rows = (data ?? []) as unknown as MobileJobWithPresentation[];
  const [commercial, stopData] = await Promise.all([
    loadDriverAgreedRates(supabaseAdmin, rows),
    loadStops(rows.map((row) => row.id)),
  ]);
  const nextCursor = completedHistory && rows.length === limit
    ? rows[rows.length - 1]?.updated_at ?? null
    : null;

  let podPresentationPartial = false;
  let pods = new Map<string, Record<string, unknown> | null>();
  try {
    pods = await buildSignedPodPresentations(rows, driver.companyId);
  } catch {
    podPresentationPartial = true;
  }

  let attachmentPresentationPartial = false;
  let attachments = new Map<string, Array<Record<string, unknown>>>();
  try {
    attachments = await buildSignedJobAttachments(rows);
  } catch {
    attachmentPresentationPartial = true;
  }

  return respond(200, {
    scope,
    ...(completedHistory ? { historyDays, nextCursor } : {}),
    jobs: rows.map((row) => {
      const agreedRate = commercial.rates.get(row.id) ?? null;
      const operational = buildJobOperationalPresentation(row);
      const persistentStops = stopData.stopsByJob.get(row.id) ?? [];
      return {
        ...mapJob(row),
        ...operational,
        stops: persistentStops.length > 0 ? persistentStops : operational.legacyStops,
        attachments: attachments.get(row.id) ?? [],
        pod: pods.get(row.id) ?? null,
        price: toMoney(agreedRate),
        agreedRateAmount: agreedRate,
        budgetAmount: agreedRate,
      };
    }),
    commercialRatePartial: commercial.partial,
    multiDropPartial: stopData.partial,
    podPresentationPartial,
    attachmentPresentationPartial,
  });
}
