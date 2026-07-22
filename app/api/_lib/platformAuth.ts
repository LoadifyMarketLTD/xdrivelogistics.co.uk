import type { User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from './supabaseAdmin';

export type PlatformAccessFailure = {
  status: 401 | 403 | 503;
  error: string;
};

export type PlatformAccessResult =
  | { ok: true; user: User }
  | { ok: false; failure: PlatformAccessFailure };

/**
 * Platform ownership is stored only in profiles.role.
 * Ordinary company ownership is stored separately in company_memberships.role
 * and must never satisfy this predicate.
 */
export const isPlatformOwnerProfileRole = (role: unknown): role is 'owner' => role === 'owner';

/**
 * Canonical platform-owner authorisation.
 *
 * The repository's persisted application role `owner` is the canonical source
 * for the workspace role `platform_owner`. Company membership ownership is not
 * sufficient: this helper reads profiles.role for the authenticated user and
 * never trusts client-provided role or company values.
 */
export async function requirePlatformOwner(request: NextRequest): Promise<PlatformAccessResult> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { ok: false, failure: { status: 503, error: 'Server auth is not configured.' } };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, failure: { status: 401, error: 'Unauthorized.' } };
  }

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { ok: false, failure: { status: 401, error: 'Unauthorized: invalid or expired token.' } };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile || !isPlatformOwnerProfileRole(profile.role)) {
    return { ok: false, failure: { status: 403, error: 'Forbidden: platform owner role required.' } };
  }

  return { ok: true, user: authData.user };
}
