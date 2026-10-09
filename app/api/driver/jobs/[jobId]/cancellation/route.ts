import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../../../_lib/webDriverContext';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const { jobId } = await context.params;
  const body = await request.json().catch(() => null) as { reason?: string } | null;
  const reason = body?.reason?.trim() ?? '';
  if (reason.length < 5) {
    return respond(400, { error: 'A cancellation reason of at least 5 characters is required.' });
  }

  const { data, error } = await supabaseAdmin.rpc('request_awarded_job_cancellation_atomic', {
    p_job_id: jobId,
    p_actor_user_id: driver.userId,
    p_reason: reason,
  });

  if (error) {
    const message = error.message || 'Cancellation could not be requested.';
    const status = /only the load owner or awarded carrier|permission/i.test(message) ? 403 : 400;
    return respond(status, { error: message });
  }

  return respond(200, { success: true, result: data });
}
