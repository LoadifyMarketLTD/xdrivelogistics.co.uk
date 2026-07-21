import type { SupabaseClient } from '@supabase/supabase-js';

import { classifyAccessLifecycleStatus, normalizeAccessStatus } from '../../../../lib/accessLifecycle';
import { normalizeProfileRoleForStorage } from '../../../../lib/authRole';
import type { OnboardingAccountType, OnboardingStatus } from '../../_lib/onboarding';

const PROFILE_ROLE_BY_ACCOUNT_TYPE: Record<OnboardingAccountType, 'customer' | 'broker' | 'company_admin' | 'driver'> = {
  customer_shipper: 'customer',
  broker_shipper: 'broker',
  fleet_courier: 'company_admin',
  owner_driver: 'driver',
};

const updateOwnerDriverAccess = async (
  client: SupabaseClient,
  userId: string,
  enabled: boolean,
  companyId: string | null,
): Promise<Error | null> => {
  const driverPatch: Record<string, unknown> = {
    app_access: enabled,
    updated_at: new Date().toISOString(),
  };
  if (companyId) driverPatch.company_id = companyId;
  if (enabled) driverPatch.status = 'active';

  const { error } = await client
    .from('drivers')
    .update(driverPatch)
    .eq('user_id', userId);

  return error ? new Error(error.message) : null;
};

const syncCanonicalAuthRole = async (
  client: SupabaseClient,
  userId: string,
  canonicalRole: 'customer' | 'broker' | 'company_admin' | 'driver',
): Promise<Error | null> => {
  const { error } = await client.auth.admin.updateUserById(userId, {
    app_metadata: { role: canonicalRole },
  });
  return error ? new Error(error.message) : null;
};

const syncMembershipLifecycle = async (
  client: SupabaseClient,
  userId: string,
  companyId: string | null,
  membershipStatus: 'invited' | 'active' | 'suspended',
): Promise<Error | null> => {
  if (!companyId) return null;

  const { error } = await client
    .from('company_memberships')
    .update({
      status: membershipStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .eq('user_id', userId);

  return error ? new Error(error.message) : null;
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
    .select('role, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileReadError) return new Error(profileReadError.message);

  const existingStatus = normalizeAccessStatus(existingProfile?.status);
  const existingAccessState = classifyAccessLifecycleStatus(existingStatus);

  // A manual security block must never be removed merely because the applicant
  // opens an onboarding page, signs in again, or an onboarding status is read.
  if (existingAccessState === 'blocked') {
    const membershipError = await syncMembershipLifecycle(client, userId, companyId, 'suspended');
    if (membershipError) return membershipError;
    return accountType === 'owner_driver'
      ? updateOwnerDriverAccess(client, userId, false, companyId)
      : null;
  }

  const lifecycleStatus = status === 'approved'
    ? 'active'
    : status === 'rejected'
      ? 'blocked'
      : 'pending';
  const membershipStatus = status === 'approved'
    ? 'active'
    : status === 'rejected'
      ? 'suspended'
      : 'invited';

  // The onboarding RPC creates a company membership so documents can be linked,
  // but that membership must not become an operational workspace credential
  // before approval. Most RLS policies require status = active, so keeping it
  // invited closes direct API access as well as browser-page access.
  const membershipError = await syncMembershipLifecycle(client, userId, companyId, membershipStatus);
  if (membershipError) return membershipError;

  const canonicalRole = PROFILE_ROLE_BY_ACCOUNT_TYPE[accountType];
  const legacyCompatibleRole = normalizeProfileRoleForStorage(canonicalRole) ?? canonicalRole;
  const profilePatch: Record<string, unknown> = {
    user_id: userId,
    role: canonicalRole,
    status: lifecycleStatus,
    is_driver: accountType === 'owner_driver',
    updated_at: new Date().toISOString(),
  };
  if (companyId) profilePatch.company_id = companyId;

  let { error: profileError } = await client
    .from('profiles')
    .upsert(profilePatch, { onConflict: 'user_id' });

  // Some live databases still enforce the older profile-role constraint
  // (admin/company rather than company_admin/broker). Prefer canonical values,
  // then retry only the role value so onboarding remains compatible during the
  // controlled schema migration period.
  if (profileError && legacyCompatibleRole !== canonicalRole) {
    const retry = await client
      .from('profiles')
      .upsert({ ...profilePatch, role: legacyCompatibleRole }, { onConflict: 'user_id' });
    profileError = retry.error;
  }

  if (profileError) return new Error(profileError.message);

  // Profile storage may temporarily use a legacy-compatible role. The signed
  // auth identity always keeps the canonical role so the next token refresh or
  // login resolves Broker/Fleet/Customer/Owner Driver without ambiguity.
  const metadataError = await syncCanonicalAuthRole(client, userId, canonicalRole);
  if (metadataError) return metadataError;

  if (accountType !== 'owner_driver') return null;

  return updateOwnerDriverAccess(
    client,
    userId,
    status === 'approved' && lifecycleStatus === 'active',
    companyId,
  );
};
