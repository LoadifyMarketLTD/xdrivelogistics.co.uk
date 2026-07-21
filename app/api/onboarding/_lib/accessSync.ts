import type { SupabaseClient } from '@supabase/supabase-js';
import type { OnboardingAccountType, OnboardingStatus } from '../../_lib/onboarding';

const PROFILE_ROLE_BY_ACCOUNT_TYPE: Record<OnboardingAccountType, 'customer' | 'broker' | 'company_admin' | 'driver'> = {
  customer_shipper: 'customer',
  broker_shipper: 'broker',
  fleet_courier: 'company_admin',
  owner_driver: 'driver',
};

export const syncOnboardingAccess = async (
  client: SupabaseClient,
  {
    userId,
    accountType,
    status,
    companyId,
  }: {
    userId: string;
    accountType: OnboardingAccountType;
    status: OnboardingStatus;
    companyId: string | null;
  }
): Promise<Error | null> => {
  const { data: existingProfile, error: profileReadError } = await client
    .from('profiles')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileReadError) return new Error(profileReadError.message);

  const lifecycleStatus = status === 'approved'
    ? 'active'
    : status === 'rejected'
      ? 'blocked'
      : 'pending';
  const profileStatus = String(existingProfile?.status ?? '').toLowerCase() === 'suspended'
    ? 'suspended'
    : lifecycleStatus;

  const profilePatch: Record<string, unknown> = {
    user_id: userId,
    role: PROFILE_ROLE_BY_ACCOUNT_TYPE[accountType],
    status: profileStatus,
    is_driver: accountType === 'owner_driver',
    updated_at: new Date().toISOString(),
  };
  if (companyId) profilePatch.company_id = companyId;

  const { error: profileError } = await client
    .from('profiles')
    .upsert(profilePatch, { onConflict: 'user_id' });

  if (profileError) return new Error(profileError.message);
  if (accountType !== 'owner_driver') return null;

  const driverPatch: Record<string, unknown> = {
    app_access: status === 'approved' && profileStatus !== 'suspended',
    updated_at: new Date().toISOString(),
  };
  if (companyId) driverPatch.company_id = companyId;
  if (status === 'approved' && profileStatus !== 'suspended') driverPatch.status = 'active';

  const { error: driverError } = await client
    .from('drivers')
    .update(driverPatch)
    .eq('user_id', userId);

  return driverError ? new Error(driverError.message) : null;
};
