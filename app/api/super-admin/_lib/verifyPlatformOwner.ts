import type { NextRequest } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export type VerifiedPlatformOwner = {
  id: string;
  email: string | null;
};

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const isSuperAdminDeployPreviewReadOnly = () =>
  process.env.CONTEXT === 'deploy-preview'
  || Boolean(process.env.DEPLOY_PRIME_URL?.includes('deploy-preview-'))
  || Boolean(process.env.URL?.includes('deploy-preview-'));

export async function verifyPlatformOwner(request: NextRequest): Promise<VerifiedPlatformOwner | null> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;

  // PR #431 is an inspectable Netlify Deploy Preview connected to live data for
  // read-only truth checks. Fail closed before authentication/data mutation for
  // every Super Admin write method so no forgotten UI action can write to the
  // Production-backed environment from a preview deployment.
  if (isSuperAdminDeployPreviewReadOnly() && !READ_ONLY_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const token = getBearerToken(request);
  if (!token) return null;

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, status')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile) return null;
  if (String(profile.role ?? '').toLowerCase() !== 'owner') return null;
  if (String(profile.status ?? 'active').toLowerCase() !== 'active') return null;

  return {
    id: authData.user.id,
    email: authData.user.email ?? null,
  };
}
