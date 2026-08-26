import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  '';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_KEY?.trim() ||
  '';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && !process.env.SUPABASE_SERVICE_KEY?.trim()) {
  console.error('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not set — admin operations are disabled.');
} else if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && process.env.SUPABASE_SERVICE_KEY?.trim()) {
  console.warn('[supabaseAdmin] Using legacy SUPABASE_SERVICE_KEY — prefer SUPABASE_SERVICE_ROLE_KEY.');
}

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && supabaseServiceKey);

const clientOpts = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, clientOpts)
  : null;

export const supabaseValidator =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, clientOpts)
    : supabaseAdmin;

export const getBearerToken = (request: NextRequest) => {
  const authHeader = request.headers.get('authorization') ?? '';
  const [scheme, ...rest] = authHeader.split(' ');
  const token = rest.join(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const jwtSessionId = (token: string): string | null => {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { session_id?: unknown };
    return typeof payload.session_id === 'string' && UUID_RE.test(payload.session_id)
      ? payload.session_id
      : null;
  } catch {
    return null;
  }
};

/**
 * Preserve web/legacy sessions while making every JWT that has entered the
 * native-device registry obey that registry for the rest of its lifetime.
 *
 * A normal web JWT has no row in driver_mobile_device_sessions and is unaffected.
 * A native JWT has an auth_session_id row; once that row is disabled/revoked it
 * cannot continue using generic driver endpoints during the remaining JWT TTL.
 */
export async function validateKnownNativeAuthSession(
  token: string,
  userId: string,
): Promise<{ allowed: boolean; knownNative: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { allowed: false, knownNative: false, error: 'Server auth is not configured.' };
  }
  const sessionId = jwtSessionId(token);
  if (!sessionId) return { allowed: true, knownNative: false };

  const { data: binding, error } = await supabaseAdmin
    .from('driver_mobile_device_sessions')
    .select('user_id,enabled,revoked_at')
    .eq('auth_session_id', sessionId)
    .maybeSingle();

  if (error) {
    return { allowed: false, knownNative: false, error: 'Mobile device session validation failed.' };
  }
  if (!binding) return { allowed: true, knownNative: false };
  if (String(binding.user_id) !== userId) {
    return { allowed: false, knownNative: true, error: 'Native session identity mismatch.' };
  }
  if (binding.enabled !== true || binding.revoked_at != null) {
    return { allowed: false, knownNative: true, error: 'This native device session has been revoked.' };
  }
  return { allowed: true, knownNative: true };
}
