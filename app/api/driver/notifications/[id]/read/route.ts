import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isDriverContext } from '../../../mobile/_lib';
import { requireWebDriver } from '../../../_lib/webDriver';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Notification update is temporarily unavailable.' });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id } = await context.params;
  const notificationId = id?.trim();
  if (!notificationId) return json(400, { error: 'Notification id is required.' });

  const readAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: readAt })
    .eq('id', notificationId)
    .eq('user_id', driver.userId)
    .select('id, read_at')
    .maybeSingle();

  if (error) return json(500, { error: 'This notification could not be marked as read.' });
  if (!data) return json(404, { error: 'Notification not found.' });
  return json(200, { success: true, notificationId, readAt: data.read_at ?? readAt });
}
