import { NextRequest } from 'next/server';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond } from '../../_lib';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;
  const { data, error } = await driver.db
    .from('jobs')
    .select(jobSelect)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'Job not found.' });

  return respond(200, { job: mapJob(data as unknown as MobileJobRow) });
}
