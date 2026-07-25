import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';
import { isExpoPushToken } from '@/lib/pushNotifications';

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return respond(400, { error: 'token is required.' });
  if (!isExpoPushToken(token)) {
    return respond(400, { error: 'Only Expo push tokens are accepted by the mobile push provider.' });
  }

  const { error } = await supabaseAdmin
    .from('drivers')
    .update({ device_token: token })
    .eq('id', driver.driverId);

  if (error) return respond(500, { error: error.message });
  return respond(200, { ok: true });
}
