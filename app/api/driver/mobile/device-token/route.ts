import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

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

  // deviceId identifies a specific physical device; callers should supply a
  // stable per-installation UUID.  Fall back to the token itself as a key so
  // the single-device legacy path keeps working even without migration 131.
  const deviceId = (typeof body.deviceId === 'string' && body.deviceId.trim())
    ? body.deviceId.trim()
    : token;

  const platform = typeof body.platform === 'string' ? body.platform.trim() : null;
  const appVersion = typeof body.appVersion === 'string' ? body.appVersion.trim() : null;
  const now = new Date().toISOString();

  // Upsert into the multi-device table (migration 131).
  // If the table does not exist yet the query will fail silently; in that case
  // fall back to the legacy single-column update so old devices keep working.
  const { error: upsertError } = await supabaseAdmin
    .from('driver_device_tokens')
    .upsert(
      {
        driver_id: driver.driverId,
        user_id: driver.userId,
        device_id: deviceId,
        expo_push_token: token,
        platform,
        app_version: appVersion,
        active: true,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: 'driver_id,device_id' }
    );

  if (upsertError) {
    // Table may not exist yet on older deployments — fall back to legacy field.
    const { error: legacyError } = await supabaseAdmin
      .from('drivers')
      .update({ device_token: token, updated_at: now })
      .eq('id', driver.driverId);

    if (legacyError) return respond(500, { error: legacyError.message });
  }

  return respond(200, { ok: true });
}

// ── DELETE /api/driver/mobile/device-token ───────────────────────────────────
// Deactivate the token for a specific device on logout.

export async function DELETE(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  if (!deviceId) return respond(400, { error: 'deviceId is required.' });

  const { error } = await supabaseAdmin
    .from('driver_device_tokens')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('driver_id', driver.driverId)
    .eq('device_id', deviceId);

  if (error) {
    // Table may not exist yet — ignore
    console.warn('[device-token] deactivate failed (table may not exist):', error.message);
  }

  return respond(200, { ok: true });
}
