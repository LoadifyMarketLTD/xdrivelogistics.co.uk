import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { loadDriverAgreedRates } from '../../../_lib/commercialRate';
import { buildSignedJobAttachments } from '../../jobAttachmentPresentation';
import { buildJobOperationalPresentation, driverJobOperationalSelect } from '../../jobOperationalPresentation';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond, toMoney } from '../../_lib';
import { buildSignedPodPresentations } from '../../podPresentation';

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

type DriverInstructionRow = {
  id: string;
  message: string | null;
  notes: string | null;
  event_time: string | null;
  created_at: string | null;
  user_name: string | null;
};

type DriverDetailRow = MobileJobRow & Record<string, unknown> & {
  damage_photos?: unknown;
  pod_generated_at?: string | null;
  driver_notes?: string | null;
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

function formatInstructionTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function mapDriverInstructions(rows: DriverInstructionRow[]) {
  const messages = rows.map((entry) => {
    const instruction = String(entry.message ?? entry.notes ?? '').trim();
    if (!instruction) return '';
    const at = formatInstructionTime(entry.event_time ?? entry.created_at);
    const author = String(entry.user_name ?? 'Posting company').trim() || 'Posting company';
    return [at, author].filter(Boolean).join(' · ') + `\n${instruction}`;
  }).filter(Boolean);
  return messages.length ? messages.join('\n\n') : undefined;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(`${jobSelect},damage_photos,pod_generated_at,driver_notes,${driverJobOperationalSelect}`)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'Job not found.' });

  const row = data as unknown as DriverDetailRow;
  const [commercial, stopsResult, instructionsResult] = await Promise.all([
    loadDriverAgreedRates(supabaseAdmin, [row]),
    supabaseAdmin
      .from('job_stops')
      .select('id, sequence, stop_type, address, postcode, company_name, contact_name, contact_phone, window_start, window_end, instructions, status, arrived_at, completed_at')
      .eq('job_id', id)
      .order('sequence', { ascending: true }),
    supabaseAdmin
      .from('job_tracking_events')
      .select('id, message, notes, event_time, created_at, user_name')
      .eq('job_id', id)
      .eq('event_type', 'driver_instruction_added')
      .order('event_time', { ascending: true })
      .limit(200),
  ]);

  let podPresentationPartial = false;
  let pod: Record<string, unknown> | null = null;
  try {
    const podPresentations = await buildSignedPodPresentations([row], driver.companyId);
    pod = podPresentations.get(row.id) ?? null;
  } catch {
    podPresentationPartial = true;
  }

  let attachmentPresentationPartial = false;
  let attachments: Array<Record<string, unknown>> = [];
  try {
    const attachmentsByJob = await buildSignedJobAttachments([row]);
    attachments = attachmentsByJob.get(row.id) ?? [];
  } catch {
    attachmentPresentationPartial = true;
  }

  const agreedRate = commercial.rates.get(row.id) ?? null;
  const multiDropPartial = Boolean(stopsResult.error);
  const driverInstructionsPartial = Boolean(instructionsResult.error);
  const operational = buildJobOperationalPresentation(row);
  const persistentStops = stopsResult.error
    ? []
    : ((stopsResult.data ?? []) as unknown as JobStopRow[]).map(mapStop);
  const specialInstructions = instructionsResult.error
    ? operational.specialInstructions
    : mapDriverInstructions((instructionsResult.data ?? []) as unknown as DriverInstructionRow[]) ?? operational.specialInstructions;

  return respond(200, {
    job: {
      ...mapJob(row),
      ...operational,
      // Persisted multi-drop remains authoritative. Legacy two-point stops from
      // the operational helper are used only for historical jobs with no job_stops.
      stops: persistentStops.length > 0 ? persistentStops : operational.legacyStops,
      specialInstructions,
      attachments,
      pod,
      podCompleted: Boolean(pod),
      price: toMoney(agreedRate),
      agreedRateAmount: agreedRate,
      budgetAmount: agreedRate,
    },
    commercialRatePartial: commercial.partial,
    multiDropPartial,
    driverInstructionsPartial,
    podPresentationPartial,
    attachmentPresentationPartial,
  });
}
