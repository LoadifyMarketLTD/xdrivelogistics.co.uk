import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond } from '../../_lib';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
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

  return respond(200, { job: mapJob(data as unknown as MobileJobRow) });
}
