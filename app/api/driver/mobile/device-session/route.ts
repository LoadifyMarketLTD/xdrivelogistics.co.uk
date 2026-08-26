import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';

const ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionIdAfterValidation(token: string): string | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { session_id?: unknown };
    return typeof payload.session_id === 'string' && UUID_RE.test(payload.session_id) ? payload.session_id : null;
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
  const sessionId = sessionIdAfterValidation(token);
  if (!sessionId) return { error: NextResponse.json({ error: 'Authenticated session identity is required.' }, { status: 401 }) };

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, status, app_access')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (driverError) return { error: NextResponse.json({ error: 'Driver identity lookup failed.' }, { status: 500 }) };
  if (!driver || driver.status !== 'active' || driver.app_access !== true) {
    return { error: NextResponse.json({ error: 'Active driver access is required.' }, { status: 403 }) };
  }

  return { token, userId: authData.user.id, driverId: String(driver.id), sessionId };
}

export async function POST(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;

  let body: { installation_id?: unknown; app_package?: unknown; device_label?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const installationId = typeof body.installation_id === 'string' ? body.installation_id.trim() : '';
  const appPackage = typeof body.app_package === 'string' ? body.app_package.trim() : '';
  const deviceLabel = typeof body.device_label === 'string' ? body.device_label.trim().slice(0, 120) : null;
  if (!UUID_RE.test(installationId)) return NextResponse.json({ error: 'A valid installation_id is required.' }, { status: 400 });
  if (appPackage !== ANDROID_PACKAGE) return NextResponse.json({ error: 'Unsupported Android application package.' }, { status: 400 });

  const now = new Date().toISOString();

  // Newest native login wins. Revoke any previous XDrive mobile binding for this
  // named driver before activating this exact installation + Supabase session.
  const { error: revokeError } = await supabaseAdmin!
    .from('driver_mobile_device_sessions')
    .update({ enabled: false, revoked_at: now, updated_at: now })
    .eq('driver_id', auth.driverId)
    .eq('enabled', true)
    .is('revoked_at', null)
    .neq('installation_id', installationId);
  if (revokeError) return NextResponse.json({ error: 'Previous mobile device could not be revoked.' }, { status: 500 });

  // A reinstall or relogin may reuse the same installation id with a new auth session.
  const { error: upsertError } = await supabaseAdmin!
    .from('driver_mobile_device_sessions')
    .upsert({
      installation_id: installationId,
      user_id: auth.userId,
      driver_id: auth.driverId,
      auth_session_id: auth.sessionId,
      platform: 'android',
      app_package: ANDROID_PACKAGE,
      device_label: deviceLabel,
      enabled: true,
      revoked_at: null,
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: 'installation_id' });
  if (upsertError) return NextResponse.json({ error: 'Mobile device session could not be registered.' }, { status: 500 });

  // Supabase Auth has no free project-level single-session guarantee. Use the
  // current validated access token to revoke refresh capability for other user
  // sessions while preserving this login. Old JWTs may survive until expiry, so
  // XDrive mobile endpoints additionally enforce the registry above.
  const authBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (authBase && anonKey) {
    try {
      await fetch(`${authBase.replace(/\/$/, '')}/auth/v1/logout?scope=others`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        cache: 'no-store',
      });
    } catch {
      // Registry enforcement is authoritative for XDrive mobile access. Other-session
      // Auth revocation is defense in depth and must not roll back a safe binding.
    }
  }

  return NextResponse.json({ ok: true, installationId, policy: 'newest_native_login_wins' });
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;

  const installationId = request.headers.get('x-xdrive-installation-id')?.trim() ?? '';
  if (!UUID_RE.test(installationId)) return NextResponse.json({ error: 'Device identity is required.' }, { status: 401 });

  const { data: binding, error } = await supabaseAdmin!
    .from('driver_mobile_device_sessions')
    .select('installation_id')
    .eq('installation_id', installationId)
    .eq('user_id', auth.userId)
    .eq('driver_id', auth.driverId)
    .eq('auth_session_id', auth.sessionId)
    .eq('enabled', true)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Device session validation failed.' }, { status: 500 });
  if (!binding) return NextResponse.json({ error: 'This mobile session has been revoked or replaced by another device.' }, { status: 401 });

  const now = new Date().toISOString();
  await supabaseAdmin!
    .from('driver_mobile_device_sessions')
    .update({ last_seen_at: now, updated_at: now })
    .eq('installation_id', installationId);

  return NextResponse.json({ ok: true, installationId });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;
  const installationId = request.headers.get('x-xdrive-installation-id')?.trim() ?? '';
  if (!UUID_RE.test(installationId)) return NextResponse.json({ error: 'Device identity is required.' }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin!
    .from('driver_mobile_device_sessions')
    .update({ enabled: false, revoked_at: now, updated_at: now })
    .eq('installation_id', installationId)
    .eq('user_id', auth.userId)
    .eq('driver_id', auth.driverId)
    .eq('auth_session_id', auth.sessionId);
  if (error) return NextResponse.json({ error: 'Device session could not be revoked.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
