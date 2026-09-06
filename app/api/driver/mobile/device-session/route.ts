import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const CANONICAL_ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver';
const PREVIEW_ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver.preview';
const HOSTED_PREVIEW_HOST_RE = /^deploy-preview-\d+--xdrivelogistics\.netlify\.app$/;
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

function isLoopbackRequest(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

function normalizeHost(value: string | null | undefined) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return raw.split(':')[0] ?? '';
  }
}

function isHostedPreviewRequest(request: NextRequest) {
  if (process.env.APP_ENV !== 'staging') return false;
  const hostnames = [
    request.nextUrl.hostname,
    request.headers.get('x-forwarded-host'),
    request.headers.get('host'),
    process.env.DEPLOY_PRIME_URL,
  ].map(normalizeHost).filter(Boolean);
  return hostnames.some((hostname) => HOSTED_PREVIEW_HOST_RE.test(hostname));
}

function allowPreviewWithoutRegistryWrite(request: NextRequest, appPackage: string) {
  if (appPackage !== PREVIEW_ANDROID_PACKAGE) return false;
  if (process.env.XDRIVE_LOCAL_PREVIEW_DEVICE_BYPASS === 'true' && isLoopbackRequest(request)) return true;
  return process.env.XDRIVE_HOSTED_PREVIEW_DEVICE_BYPASS === 'true' && isHostedPreviewRequest(request);
}

async function authenticatedDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 }) };
  }
  const token = getBearerToken(request);
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const authClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
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

  if (!UUID_RE.test(installationId)) {
    return NextResponse.json({ error: 'A valid installation_id is required.' }, { status: 400 });
  }

  if (allowPreviewWithoutRegistryWrite(request, appPackage)) {
    return NextResponse.json({
      ok: true,
      installationId,
      policy: isLoopbackRequest(request)
        ? 'local_preview_no_registry_write'
        : 'hosted_preview_no_registry_write',
    });
  }

  if (appPackage !== CANONICAL_ANDROID_PACKAGE) {
    return NextResponse.json({ error: 'Unsupported Android application package.' }, { status: 400 });
  }

  const { error: registerError } = await supabaseAdmin!.rpc('register_driver_mobile_device_session', {
    p_installation_id: installationId,
    p_user_id: auth.userId,
    p_driver_id: auth.driverId,
    p_auth_session_id: auth.sessionId,
    p_app_package: CANONICAL_ANDROID_PACKAGE,
    p_device_label: deviceLabel,
  });

  if (registerError) {
    const message = registerError.message || 'Mobile device session could not be registered.';
    if (registerError.code === '42501' && message.toLowerCase().includes('superseded')) {
      return NextResponse.json(
        { error: 'This mobile session has been revoked or replaced by a newer native login.' },
        { status: 401 },
      );
    }
    if (registerError.code === '42501') return NextResponse.json({ error: message }, { status: 403 });
    if (registerError.code === '28000') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (registerError.code === '22023') return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: 'Mobile device session could not be registered.' }, { status: 500 });
  }

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
      // The XDrive device registry is authoritative; Auth revocation is defense in depth.
    }
  }

  return NextResponse.json({ ok: true, installationId, policy: 'newest_native_login_wins' });
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;

  const appPackage = request.headers.get('x-xdrive-app-package')?.trim() ?? '';
  if (allowPreviewWithoutRegistryWrite(request, appPackage)) {
    const installationId = request.headers.get('x-xdrive-installation-id')?.trim() ?? '';
    if (!UUID_RE.test(installationId)) {
      return NextResponse.json({ error: 'Device identity is required.' }, { status: 401 });
    }
    return NextResponse.json({ ok: true, installationId, policy: 'preview_no_registry_write' });
  }

  const installationId = request.headers.get('x-xdrive-installation-id')?.trim() ?? '';
  if (!UUID_RE.test(installationId)) {
    return NextResponse.json({ error: 'Device identity is required.' }, { status: 401 });
  }

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
  if (!binding) {
    return NextResponse.json({ error: 'This mobile session has been revoked or replaced by another device.' }, { status: 401 });
  }

  const now = new Date().toISOString();
  await supabaseAdmin!
    .from('driver_mobile_device_sessions')
    .update({ last_seen_at: now, updated_at: now })
    .eq('installation_id', installationId)
    .eq('auth_session_id', auth.sessionId);

  return NextResponse.json({ ok: true, installationId });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;

  const appPackage = request.headers.get('x-xdrive-app-package')?.trim() ?? '';
  if (allowPreviewWithoutRegistryWrite(request, appPackage)) {
    return NextResponse.json({ ok: true, policy: 'preview_no_registry_write' });
  }

  const installationId = request.headers.get('x-xdrive-installation-id')?.trim() ?? '';
  if (!UUID_RE.test(installationId)) {
    return NextResponse.json({ error: 'Device identity is required.' }, { status: 400 });
  }

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
