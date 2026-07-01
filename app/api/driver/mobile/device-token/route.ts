import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

async function resolveDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const { data: authData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: driverRow } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!driverRow) return null;
  return {
    userId: authData.user.id,
    driverId: driverRow.id as string,
    companyId: driverRow.company_id as string,
  };
}

/**
 * POST /api/driver/mobile/device-token
 *
 * Body: { token: string, platform: 'ios' | 'android', app_version?: string }
 *
 * Registers or updates a push notification device token for the authenticated driver.
 * Tokens are stored in driver_device_tokens table (upsert by driver_id + platform).
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  let body: { token?: string; platform?: string; app_version?: string };
  try {
    body = (await request.json()) as { token?: string; platform?: string; app_version?: string };
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const { token, platform, app_version } = body;

  if (!token || typeof token !== 'string') {
    return respond(400, { error: 'token is required.' });
  }

  const validPlatforms = ['ios', 'android', 'expo'];
  const resolvedPlatform = platform && validPlatforms.includes(platform) ? platform : 'expo';

  const now = new Date().toISOString();

  // Upsert device token — one active token per driver per platform
  const { error: upsertError } = await supabaseAdmin
    .from('driver_device_tokens')
    .upsert(
      {
        driver_id: driver.driverId,
        user_id: driver.userId,
        company_id: driver.companyId,
        token,
        platform: resolvedPlatform,
        app_version: app_version ?? null,
        updated_at: now,
      },
      { onConflict: 'driver_id,platform' }
    );

  if (upsertError) {
    // Table may not exist yet — log but don't fail the app
    console.error('[device-token] upsert error:', upsertError.message);
    return respond(200, { ok: true, note: 'Token acknowledged (storage pending migration).' });
  }

  return respond(200, { ok: true });
}
