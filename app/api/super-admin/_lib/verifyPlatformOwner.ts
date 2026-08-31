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

export async function verifyPlatformOwner(request: NextRequest): Promise<VerifiedPlatformOwner | null> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;

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
