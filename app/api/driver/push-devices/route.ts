import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

const ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatedSessionId(token: string): string | null {
  // Claims are decoded only after auth.getUser(token) has validated the JWT with
  // Supabase Auth. Never use this helper as standalone JWT authentication.
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
  if (authError || !authData.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const sessionId = validatedSessionId(token);
  if (!sessionId) {
    return { error: NextResponse.json({ error: 'Authenticated session identity is required.' }, { status: 401 }) };
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, status, app_access')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (driverError || !driver || driver.app_access !== true) {
    return { error: NextResponse.json({ error: 'Active driver access is required.' }, { status: 403 }) };
  }

  return { userId: authData.user.id, driverId: driver.id, sessionId };
}

export async function POST(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;

  let body: { token?: unknown; installation_id?: unknown; app_package?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const fcmToken = typeof body.token === 'string' ? body.token.trim() : '';
  const installationId = typeof body.installation_id === 'string' ? body.installation_id.trim() : '';
  const appPackage = typeof body.app_package === 'string' ? body.app_package.trim() : '';

  if (fcmToken.length < 20 || fcmToken.length > 4096) {
    return NextResponse.json({ error: 'A valid push token is required.' }, { status: 400 });
  }
  if (!UUID_RE.test(installationId)) {
    return NextResponse.json({ error: 'A valid installation_id is required.' }, { status: 400 });
  }
  if (appPackage !== ANDROID_PACKAGE) {
    return NextResponse.json({ error: 'Unsupported Android application package.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // A provider token can rotate. Remove any stale row currently owning the new
  // token, then bind this installation to the authenticated driver/session only.
  const { error: tokenCleanupError } = await supabaseAdmin!
    .from('driver_push_devices')
    .delete()
    .eq('fcm_token', fcmToken)
    .neq('installation_id', installationId);
  if (tokenCleanupError) {
    return NextResponse.json({ error: 'Push registration could not be reconciled.' }, { status: 500 });
  }

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

  if (error) {
    return NextResponse.json({ error: 'Push registration could not be saved.' }, { status: 500 });
  }

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

  if (!UUID_RE.test(installationId)) {
    return NextResponse.json({ error: 'A valid installation_id is required.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin!
    .from('driver_push_devices')
    .delete()
    .eq('installation_id', installationId)
    .eq('user_id', auth.userId)
    .eq('driver_id', auth.driverId);

  if (error) {
    return NextResponse.json({ error: 'Push registration could not be removed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
