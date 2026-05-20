import type { SupabaseClient } from '@supabase/supabase-js';

interface ResolveAdminCompanyIdArgs {
  userId: string;
  currentCompanyId?: string | null;
  supabase: SupabaseClient;
}

export async function resolveAdminCompanyId({
  userId,
  currentCompanyId,
  supabase,
}: ResolveAdminCompanyIdArgs): Promise<string | null> {
  if (currentCompanyId) {
    return currentCompanyId;
  }

  const { data, error } = await supabase.rpc('get_or_create_company_for_user');
  if (!error && data) {
    return data as string;
  }

  if (error) {
    console.error('get_or_create_company_for_user failed:', error.message);
  }

  const { data: membership, error: membershipError } = await supabase
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', userId)
    .neq('status', 'suspended')
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error('Failed to resolve company membership:', membershipError.message);
  }

  return (membership?.company_id as string) ?? null;
}
