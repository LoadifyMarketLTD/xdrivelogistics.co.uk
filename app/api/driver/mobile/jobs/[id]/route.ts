import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { driverJobStatusesForScope } from '../../../../../../lib/jobs/jobLifecyclePresentation';
import { loadDriverAgreedRates } from '../../../_lib/commercialRate';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond, toMoney } from '../../_lib';
import { buildSignedJobAttachments } from '../../jobAttachmentPresentation';
import { buildJobOperationalPresentation, driverJobOperationalSelect } from '../../jobOperationalPresentation';
import { buildSignedPodPresentations } from '../../podPresentation';

type MobileJobWithPresentation = MobileJobRow & Record<string, unknown> & {
  damage_photos?: unknown;
  pod_generated_at?: string | null;
  driver_notes?: string | null;
};

const detailReadableStatuses = new Set([
  ...(driverJobStatusesForScope('upcoming') ?? []),
  ...(driverJobStatusesForScope('active') ?? []),
  ...(driverJobStatusesForScope('completed') ?? []),
].map((status) => String(status).trim().toLowerCase()));

function executionStatus(row: Pick<MobileJobRow, 'status' | 'current_status'>) {
  return String(row.current_status || row.status || '').trim().toLowerCase();
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

  const row = data as unknown as MobileJobWithPresentation;
  const status = executionStatus(row);
  if (!detailReadableStatuses.has(status)) {
    const message = status === 'cancelled'
      ? 'This job has been cancelled and is no longer actionable in XDrive Driver.'
      : status === 'disputed'
        ? 'This job is disputed and is no longer actionable in XDrive Driver.'
        : 'This assigned job is no longer in an executable Driver lifecycle state.';
    return respond(409, { error: message, lifecycleStatus: status || null, actionable: false });
  }

  const commercial = await loadDriverAgreedRates(supabaseAdmin, [row]);
  const agreedRate = commercial.rates.get(row.id) ?? null;

  let podPresentationPartial = false;
  let pod: Record<string, unknown> | null = null;
  try {
    const pods = await buildSignedPodPresentations([row], driver.companyId);
    pod = pods.get(row.id) ?? null;
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

  return respond(200, {
    job: {
      ...mapJob(row),
      ...buildJobOperationalPresentation(row),
      attachments,
      pod,
      price: toMoney(agreedRate),
      agreedRateAmount: agreedRate,
      // Legacy Android field retained for compatibility; assigned-job value is
      // accepted/agreed carrier rate only, never customer budget.
      budgetAmount: agreedRate,
    },
    commercialRatePartial: commercial.partial,
    podPresentationPartial,
    attachmentPresentationPartial,
  });
}
