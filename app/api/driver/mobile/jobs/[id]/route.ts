import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
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
