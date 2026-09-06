import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREVIEW_ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver.preview';
const HOSTED_PREVIEW_HOST_RE = /^deploy-preview-\d+--xdrivelogistics\.netlify\.app$/;

function sessionIdFromBearer(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { session_id?: unknown };
    return typeof payload.session_id === 'string' && UUID_RE.test(payload.session_id) ? payload.session_id : null;
  } catch {
    return null;
  }
}

function localPreviewDeviceBypass(request: NextRequest) {
  if (process.env.XDRIVE_LOCAL_PREVIEW_DEVICE_BYPASS !== 'true') return false;
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

function hostedPreviewDeviceBypass(request: NextRequest) {
  if (process.env.XDRIVE_HOSTED_PREVIEW_DEVICE_BYPASS !== 'true') return false;
  if (process.env.APP_ENV !== 'staging') return false;
  const appPackage = request.headers.get('x-xdrive-app-package')?.trim() ?? '';
  if (appPackage !== PREVIEW_ANDROID_PACKAGE) return false;
  const hostnames = [
    request.nextUrl.hostname,
    request.headers.get('x-forwarded-host'),
    request.headers.get('host'),
    process.env.DEPLOY_PRIME_URL,
  ].map(normalizeHost).filter(Boolean);
  return hostnames.some((hostname) => HOSTED_PREVIEW_HOST_RE.test(hostname));
}

export async function requireActiveNativeAuthSession(
  request: NextRequest,
  userId: string,
  driverId: string,
): Promise<NextResponse | null> {
  if (localPreviewDeviceBypass(request) || hostedPreviewDeviceBypass(request)) return null;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });

  const sessionId = sessionIdFromBearer(request);
  if (!sessionId) return NextResponse.json({ error: 'Authenticated session identity is required.' }, { status: 401 });

  const [{ data: active, error: activeError }, { data: history, error: historyError }] = await Promise.all([
    supabaseAdmin
      .from('driver_mobile_device_sessions')
      .select('installation_id, auth_session_id')
      .eq('user_id', userId)
      .eq('driver_id', driverId)
      .eq('enabled', true)
      .is('revoked_at', null)
      .maybeSingle(),
    supabaseAdmin
      .from('driver_mobile_device_sessions')
      .select('installation_id')
      .eq('user_id', userId)
      .eq('driver_id', driverId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (activeError || historyError) {
    return NextResponse.json({ error: 'Mobile device session validation failed.' }, { status: 500 });
  }
  if (!active) {
    if (history) return NextResponse.json({ error: 'No active native device session is authorised.' }, { status: 401 });
    return null;
  }

  const installationId = request.headers.get('x-xdrive-installation-id')?.trim() ?? '';
  if (!UUID_RE.test(installationId)) {
    return NextResponse.json({ error: 'Active native device identity is required.' }, { status: 401 });
  }
  if (String(active.installation_id) !== installationId || String(active.auth_session_id) !== sessionId) {
    return NextResponse.json({ error: 'This mobile session has been revoked or replaced by another device.' }, { status: 401 });
  }

  void supabaseAdmin
    .from('driver_mobile_device_sessions')
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('installation_id', installationId)
    .eq('auth_session_id', sessionId);
  return null;
}

export async function rejectRevokedNativeAuthSession(
  request: NextRequest,
  userId: string,
  driverId: string,
): Promise<NextResponse | null> {
  if (localPreviewDeviceBypass(request) || hostedPreviewDeviceBypass(request)) return null;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });

  const sessionId = sessionIdFromBearer(request);
  if (!sessionId) return NextResponse.json({ error: 'Authenticated session identity is required.' }, { status: 401 });

  const { data: binding, error } = await supabaseAdmin
    .from('driver_mobile_device_sessions')
    .select('installation_id, enabled, revoked_at')
    .eq('user_id', userId)
    .eq('driver_id', driverId)
    .eq('auth_session_id', sessionId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Mobile device session validation failed.' }, { status: 500 });
  if (!binding) return null;
  if (binding.enabled !== true || binding.revoked_at) {
    return NextResponse.json({ error: 'This mobile session has been revoked or replaced by another device.' }, { status: 401 });
  }

  void supabaseAdmin
    .from('driver_mobile_device_sessions')
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('auth_session_id', sessionId);
  return null;
}
