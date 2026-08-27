import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

const ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatedSessionId(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { session_id?: unknown };
    return typeof claims.session_id === 'string' && UUID_RE.test(claims.session_id)
      ? claims.session_id
      : null;
  } catch {
    return null;
  }
}

async function authenticatedDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 }) };
  }
  const token = getBearerToken(request);
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const sessionId = validatedSessionId(token);
  if (!sessionId) return { error: NextResponse.json({ error: 'Authenticated session identity is required.' }, { status: 401 }) };

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, status, app_access')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (driverError || !driver || driver.app_access !== true) {
    return { error: NextResponse.json({ error: 'Active driver access is required.' }, { status: 403 }) };
  }

  return { userId: authData.user.id, driverId: String(driver.id), sessionId };
}

async function requireActiveBinding(userId: string, driverId: string, sessionId: string, installationId: string) {
  const { data, error } = await supabaseAdmin!
    .from('driver_mobile_device_sessions')
    .select('installation_id')
    .eq('installation_id', installationId)
    .eq('user_id', userId)
    .eq('driver_id', driverId)
    .eq('auth_session_id', sessionId)
    .eq('enabled', true)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Mobile device session validation failed.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'This mobile session has been revoked or replaced by another device.' }, { status: 401 });
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;

  let body: { token?: unknown; installation_id?: unknown; app_package?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }

  const fcmToken = typeof body.token === 'string' ? body.token.trim() : '';
  const installationId = typeof body.installation_id === 'string' ? body.installation_id.trim() : '';
  const appPackage = typeof body.app_package === 'string' ? body.app_package.trim() : '';
  if (fcmToken.length < 20 || fcmToken.length > 4096) return NextResponse.json({ error: 'A valid push token is required.' }, { status: 400 });
  if (!UUID_RE.test(installationId)) return NextResponse.json({ error: 'A valid installation_id is required.' }, { status: 400 });
  if (appPackage !== ANDROID_PACKAGE) return NextResponse.json({ error: 'Unsupported Android application package.' }, { status: 400 });

  const bindingError = await requireActiveBinding(auth.userId, auth.driverId, auth.sessionId, installationId);
  if (bindingError) return bindingError;

  const now = new Date().toISOString();
  const { error: tokenCleanupError } = await supabaseAdmin!
    .from('driver_push_devices')
    .delete()
    .eq('fcm_token', fcmToken)
    .neq('installation_id', installationId);
  if (tokenCleanupError) return NextResponse.json({ error: 'Push registration could not be reconciled.' }, { status: 500 });

  const { error } = await supabaseAdmin!
    .from('driver_push_devices')
    .upsert({
      user_id: auth.userId,
      driver_id: auth.driverId,
      auth_session_id: auth.sessionId,
      installation_id: installationId,
      platform: 'android',
      app_package: ANDROID_PACKAGE,
      fcm_token: fcmToken,
      enabled: true,
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: 'installation_id' });
  if (error) return NextResponse.json({ error: 'Push registration could not be saved.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;

  let installationId = '';
  try {
    const body = await request.json();
    installationId = typeof body?.installation_id === 'string' ? body.installation_id.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!UUID_RE.test(installationId)) return NextResponse.json({ error: 'A valid installation_id is required.' }, { status: 400 });

  const { error } = await supabaseAdmin!
    .from('driver_push_devices')
    .delete()
    .eq('installation_id', installationId)
    .eq('user_id', auth.userId)
    .eq('driver_id', auth.driverId)
    .eq('auth_session_id', auth.sessionId);
  if (error) return NextResponse.json({ error: 'Push registration could not be removed.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
