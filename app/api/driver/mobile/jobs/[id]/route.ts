import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { loadDriverAgreedRates } from '../../../_lib/commercialRate';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond, toMoney } from '../../_lib';
import { buildSignedPodPresentations } from '../../podPresentation';

type MobileJobWithPodPresentation = MobileJobRow & {
  damage_photos?: unknown;
  pod_generated_at?: string | null;
  delivery_notes?: string | null;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(`${jobSelect},damage_photos,pod_generated_at,delivery_notes`)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'Job not found.' });

  const row = data as unknown as MobileJobWithPodPresentation;
  const commercial = await loadDriverAgreedRates(supabaseAdmin, [row]);
  const agreedRate = commercial.rates.get(row.id) ?? null;

  let pod: Record<string, unknown> | null = null;
  try {
    const pods = await buildSignedPodPresentations([row], driver.companyId);
    pod = pods.get(row.id) ?? null;
  } catch (reason) {
    return respond(503, {
      error: reason instanceof Error ? reason.message : 'POD evidence could not be prepared for viewing.',
    });
  }

  return respond(200, {
    job: {
      ...mapJob(row),
      pod,
      price: toMoney(agreedRate),
      agreedRateAmount: agreedRate,
      // Legacy Android field retained for compatibility; assigned-job value is
      // accepted/agreed carrier rate only, never customer budget.
      budgetAmount: agreedRate,
    },
    commercialRatePartial: commercial.partial,
  });
}
