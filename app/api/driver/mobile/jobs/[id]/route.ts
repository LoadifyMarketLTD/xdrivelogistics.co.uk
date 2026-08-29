import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { loadDriverAgreedRates } from '../../../_lib/commercialRate';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond, toMoney } from '../../_lib';

type JobStopRow = {
  id: string;
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'Job not found.' });

  const row = data as unknown as MobileJobRow;
  const [commercial, stopsResult] = await Promise.all([
    loadDriverAgreedRates(supabaseAdmin, [row]),
    supabaseAdmin
      .from('job_stops')
      .select('id, sequence, stop_type, address, postcode, company_name, contact_name, contact_phone, window_start, window_end, instructions, status, arrived_at, completed_at')
      .eq('job_id', id)
      .order('sequence', { ascending: true }),
  ]);
  const agreedRate = commercial.rates.get(row.id) ?? null;
  const multiDropPartial = Boolean(stopsResult.error);
  const stops = stopsResult.error
    ? []
    : ((stopsResult.data ?? []) as unknown as JobStopRow[]).map(mapStop);

  return respond(200, {
    job: {
      ...mapJob(row),
      stops,
      price: toMoney(agreedRate),
      agreedRateAmount: agreedRate,
      // Legacy Android field retained for compatibility; assigned-job value is
      // accepted/agreed carrier rate only, never customer budget.
      budgetAmount: agreedRate,
    },
    commercialRatePartial: commercial.partial,
    multiDropPartial,
  });
}
