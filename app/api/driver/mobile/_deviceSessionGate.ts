import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/**
 * Server-side compatibility gate for native endpoints whose oldest Android call
 * sites predate X-XDrive-Installation-Id. The registry's auth_session_id is
 * unique and is atomically bound to one installation, so matching session_id
 * still prevents a superseded device/JWT from using the endpoint.
 *
 * Once a driver has native-session history, no active row is fail-closed.
 */
export async function requireActiveNativeAuthSession(
  request: NextRequest,
  userId: string,
  driverId: string,
): Promise<NextResponse | null> {
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

  if (activeError || historyError) return NextResponse.json({ error: 'Mobile device session validation failed.' }, { status: 500 });
  if (!active) {
    if (history) return NextResponse.json({ error: 'No active native device session is authorised.' }, { status: 401 });
    return null;
  }
  if (String(active.auth_session_id) !== sessionId) {
    return NextResponse.json({ error: 'This mobile session has been revoked or replaced by another device.' }, { status: 401 });
  }

  void supabaseAdmin
    .from('driver_mobile_device_sessions')
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('auth_session_id', sessionId);

  return null;
}
