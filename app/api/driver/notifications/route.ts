import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isDriverContext } from '../mobile/_lib';
import { requireWebDriver } from '../_lib/webDriver';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Notifications are temporarily unavailable.' });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id, title, body, type, read_at, created_at')
    .eq('user_id', driver.userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return json(500, { error: 'Notifications could not be loaded.' });
  return json(200, { notifications: data ?? [] });
}
