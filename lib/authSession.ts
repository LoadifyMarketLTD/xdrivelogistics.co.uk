import { mapAppRole, roleRequiresCompanyContext, shouldAutoProvisionCompany } from './authRole';
import { supabase } from './supabaseClient';
import type { Company, CompanyMembership, Driver, Profile } from './types/database';

export type UserRole = 'guest' | 'customer' | 'driver' | 'company' | 'admin' | 'owner';

type CreatorCompanySnapshot = Pick<Company, 'id' | 'company_type'>;

export type SessionUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

export type ResolvedAuthUser = {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  driverId: string | null;
  mustChangePassword: boolean;
};

export const getFallbackRole = (sessionUser: SessionUser) =>
  typeof sessionUser.app_metadata?.role === 'string' ? sessionUser.app_metadata.role : null;

export const resolveAuthenticatedUser = async (
  sessionUser: SessionUser
): Promise<ResolvedAuthUser | null> => {
  if (!sessionUser.id) return null;

  const fallbackRole = getFallbackRole(sessionUser);
  const [profileRes, membershipRes, driverRes, creatorCompanyRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, is_driver, company_id')
      .eq('user_id', sessionUser.id)
      .maybeSingle(),
    supabase
      .from('company_memberships')
      .select('company_id, role_in_company, status')
      .eq('user_id', sessionUser.id)
      .neq('status', 'suspended')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('drivers')
      .select('id, company_id, user_id, app_access, must_change_password')
      .eq('user_id', sessionUser.id)
      .eq('app_access', true)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('id, company_type')
      .eq('created_by', sessionUser.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileRes.error || membershipRes.error || driverRes.error || creatorCompanyRes.error) {
    return null;
  }

  const profile = profileRes.data as Pick<Profile, 'role' | 'is_driver' | 'company_id'> | null;
  const membership = membershipRes.data as Pick<CompanyMembership, 'company_id' | 'role_in_company' | 'status'> | null;
  const driver = driverRes.data as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'app_access' | 'must_change_password'> | null;
  const creatorCompany = creatorCompanyRes.data as CreatorCompanySnapshot | null;
  const driverId = driver?.id ?? null;
  const mustChangePassword = Boolean(driver?.must_change_password);

  let companyId = driver?.company_id ?? profile?.company_id ?? membership?.company_id ?? creatorCompany?.id ?? null;

  if (
    !companyId &&
    shouldAutoProvisionCompany({
      fallbackRole,
      profileRole: profile?.role,
    })
  ) {
    const { data: provisionedCompanyId } = await supabase.rpc('get_or_create_company_for_user');
    if (typeof provisionedCompanyId === 'string' && provisionedCompanyId) {
      companyId = provisionedCompanyId;
    }
  }

  if (membership?.role_in_company === 'owner') {
    return companyId
      ? { id: sessionUser.id, email: sessionUser.email ?? '', role: 'owner', companyId, driverId, mustChangePassword: false }
      : null;
  }
  if (membership?.role_in_company === 'admin') {
    return companyId
      ? { id: sessionUser.id, email: sessionUser.email ?? '', role: 'admin', companyId, driverId, mustChangePassword: false }
      : null;
  }
  if (membership?.role_in_company === 'dispatcher') {
    return companyId
      ? { id: sessionUser.id, email: sessionUser.email ?? '', role: 'company', companyId, driverId, mustChangePassword: false }
      : null;
  }
  if (driver || profile?.is_driver) {
    return companyId
      ? { id: sessionUser.id, email: sessionUser.email ?? '', role: 'driver', companyId, driverId, mustChangePassword }
      : null;
  }
  if (membership?.role_in_company === 'viewer') {
    return { id: sessionUser.id, email: sessionUser.email ?? '', role: 'customer', companyId, driverId, mustChangePassword: false };
  }
  if (creatorCompany && companyId) {
    return {
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      role: creatorCompany.company_type === 'admin' ? 'admin' : 'owner',
      companyId,
      driverId,
      mustChangePassword: false,
    };
  }

  const profileRole = mapAppRole(profile?.role);
  if (profileRole) {
    if (roleRequiresCompanyContext(profileRole) && !companyId) return null;
    return {
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      role: profileRole,
      companyId,
      driverId,
      mustChangePassword: profileRole === 'driver' ? mustChangePassword : false,
    };
  }

  const metadataRole = mapAppRole(fallbackRole);
  if (metadataRole) {
    if (roleRequiresCompanyContext(metadataRole) && !companyId) return null;
    return {
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      role: metadataRole,
      companyId,
      driverId,
      mustChangePassword: metadataRole === 'driver' ? mustChangePassword : false,
    };
  }

  return null;
};

export const getPostLoginRoute = (currentUser: Pick<ResolvedAuthUser, 'role' | 'mustChangePassword'>) => {
  if (currentUser.role === 'driver') return currentUser.mustChangePassword ? '/driver/change-password' : '/driver/jobs';
  if (currentUser.role === 'customer') return '/customer';
  return '/admin';
};
