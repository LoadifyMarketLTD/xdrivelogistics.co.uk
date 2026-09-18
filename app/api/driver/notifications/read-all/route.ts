import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext } from '../../mobile/_lib';
import { requireWebDriver } from '../../_lib/webDriver';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Notification update is temporarily unavailable.' });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;
  const readAt = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: readAt })
    .eq('user_id', driver.userId)
    .is('read_at', null);

  if (error) return json(500, { error: 'Unread notifications could not be marked as read.' });
  return json(200, { success: true, readAt });
}
