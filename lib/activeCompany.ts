import { isSupabaseConfigured, supabase } from './supabaseClient';

type ResolveActiveCompanyOptions = {
  userId: string;
  fallbackCompanyId?: string | null;
};

export const resolveActiveCompanyId = async ({
  userId,
  fallbackCompanyId = null,
}: ResolveActiveCompanyOptions): Promise<string | null> => {
  if (!isSupabaseConfigured) return fallbackCompanyId;
  if (!userId) return fallbackCompanyId;

  // bootstrap_company_membership() is a SECURITY DEFINER function that:
  //   1. Reads profiles.company_id for the current user.
  //   2. Ensures a company_memberships row exists for that company (so
  //      is_company_member() RLS policies pass for drivers / quotes / docs).
  //   3. Falls back to get_or_create_company_for_user() if profile has no company.
  // Calling this first guarantees RLS passes for all subsequent queries.
  const { data: bootstrappedId } = await supabase.rpc('bootstrap_company_membership');
  if (typeof bootstrappedId === 'string' && bootstrappedId.length > 0) {
    return bootstrappedId;
  }

  // Fallback path: bootstrap_company_membership not yet deployed or returned null.
  // Use profile → membership → driver → creator company → provided fallback.
  const [profileRes, membershipRes, driverRes, creatorCompanyRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('company_memberships')
      .select('company_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('drivers')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('id')
      .eq('created_by', userId)
      .limit(1)
      .maybeSingle(),
  ]);

  let companyId =
    (profileRes.data?.company_id as string | null | undefined) ??
    (membershipRes.data?.company_id as string | null | undefined) ??
    (driverRes.data?.company_id as string | null | undefined) ??
    (creatorCompanyRes.data?.id as string | null | undefined) ??
    fallbackCompanyId;

  if (companyId) return companyId;

  const { data: provisionedCompanyId } = await supabase.rpc('get_or_create_company_for_user');
  if (typeof provisionedCompanyId === 'string' && provisionedCompanyId.length > 0) {
    companyId = provisionedCompanyId;
  }

  return companyId ?? null;
};

