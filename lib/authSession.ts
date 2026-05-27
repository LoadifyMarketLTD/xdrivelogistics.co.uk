import { resolveAuthoritativeRole, roleRequiresCompanyContext, shouldAutoProvisionCompany } from './authRole';
import { supabase } from './supabaseClient';
import type { CompanyMembership, Driver, Profile } from './types/database';

export type UserRole = 'guest' | 'customer' | 'driver' | 'company' | 'admin' | 'owner';

/**
 * Reason codes returned when auth resolution fails.
 * Used by AuthContext to show specific, actionable error messages.
 */
export type AuthFailureReason =
  | 'profile_missing'         // No profile row found; account was never fully provisioned
  | 'account_pending'         // profile.status = 'pending' — awaiting manual approval
  | 'account_blocked'         // profile.status = 'blocked' | 'suspended' | 'inactive'
  | 'role_unsupported'        // profile.role exists but does not map to any app role
  | 'company_context_missing' // Role requires a company but none could be resolved
  | 'db_error';               // Database query failed (transient or config issue)

export type AuthDbError = {
  query: string;
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
};

export type AuthResolutionResult =
  | { user: ResolvedAuthUser; reason: null }
  | { user: null; reason: Exclude<AuthFailureReason, 'db_error'> }
  | { user: null; reason: 'db_error'; dbError: AuthDbError };

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

const readMetadataRole = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export const getFallbackRole = (sessionUser: SessionUser) =>
  readMetadataRole(sessionUser.app_metadata, 'role');

export const resolveAuthenticatedUser = async (
  sessionUser: SessionUser
): Promise<AuthResolutionResult> => {
  if (!sessionUser.id) {
    return {
      user: null,
      reason: 'db_error',
      dbError: {
        query: 'auth-session-user-id',
        message: 'Missing authenticated session user id.',
        code: null,
        details: null,
        hint: null,
      },
    };
  }

  const fallbackRole = getFallbackRole(sessionUser);
  const profileLookupQuery = `profiles.select(role,status,is_driver,company_id).eq(user_id,${sessionUser.id}).maybeSingle()`;
  const membershipLookupQuery =
    `company_memberships.select(company_id,role_in_company,status).eq(user_id,${sessionUser.id}).neq(status,suspended).order(created_at desc).limit(1).maybeSingle()`;
  const driverLookupQuery =
    `drivers.select(id,company_id,user_id,must_change_password).eq(user_id,${sessionUser.id}).limit(1).maybeSingle()`;
  const creatorCompanyLookupQuery =
    `companies.select(id,company_type).eq(created_by,${sessionUser.id}).limit(1).maybeSingle()`;
  const [profileRes, membershipRes, driverRes, creatorCompanyRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, status, is_driver, company_id')
      .eq('user_id', sessionUser.id)
      .maybeSingle(),
    supabase
      .from('company_memberships')
      .select('company_id, role_in_company, status')
      .eq('user_id', sessionUser.id)
      .neq('status', 'suspended')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('drivers')
      .select('id, company_id, user_id, must_change_password')
      .eq('user_id', sessionUser.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('id, company_type')
      .eq('created_by', sessionUser.id)
      .limit(1)
      .maybeSingle(),
  ]);

  const profileDbError = profileRes.error
    ? {
        query: profileLookupQuery,
        message: profileRes.error.message,
        code: profileRes.error.code ?? null,
        details: profileRes.error.details ?? null,
        hint: profileRes.error.hint ?? null,
      }
    : null;

  if (profileDbError) {
    console.debug('[XDrive Auth] profile lookup db_error', {
      userId: sessionUser.id,
      profileQuery: profileDbError.query,
      profileErr: profileDbError.message,
      profileErrCode: profileDbError.code,
      profileErrDetails: profileDbError.details,
      profileErrHint: profileDbError.hint,
      membershipErr: membershipRes.error?.message,
      driverErr: driverRes.error?.message,
    });
  }

  if (membershipRes.error || driverRes.error || creatorCompanyRes.error) {
    console.debug('[XDrive Auth] profile lookup partial_error', {
      userId: sessionUser.id,
      membershipQuery: membershipLookupQuery,
      membershipErr: membershipRes.error?.message,
      driverQuery: driverLookupQuery,
      driverErr: driverRes.error?.message,
      creatorCompanyQuery: creatorCompanyLookupQuery,
      creatorCompanyErr: creatorCompanyRes.error?.message,
    });
  }

  const profile = profileDbError
    ? null
    : (profileRes.data as Pick<Profile, 'role' | 'status' | 'is_driver' | 'company_id'> | null);
  const membership = membershipRes.error
    ? null
    : (membershipRes.data as Pick<CompanyMembership, 'company_id' | 'role_in_company' | 'status'> | null);
  const driver = driverRes.error
    ? null
    : (driverRes.data as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'must_change_password'> | null);
  const creatorCompany = creatorCompanyRes.error
    ? null
    : (creatorCompanyRes.data as { id: string; company_type: string | null } | null);

  const driverId = driver?.id ?? null;
  const mustChangePassword = driver?.must_change_password === true;

  console.debug('[XDrive Auth] profile lookup', {
    userId: sessionUser.id,
    profileRole: profile?.role ?? null,
    profileStatus: profile?.status ?? null,
    membershipRole: membership?.role_in_company ?? null,
    hasDriver: Boolean(driver),
    hasCreatedCompany: Boolean(creatorCompany),
    fallbackRole,
  });

  // ── Profile status check ──────────────────────────────────────────────────
  // Only applied when a profile row exists. If there is no profile but the
  // user has a membership or driver record they can still authenticate.
  if (profile) {
    const status = (profile.status ?? 'active').toLowerCase();
    if (status === 'pending') {
      console.debug('[XDrive Auth] auth resolution failed', { reason: 'account_pending', userId: sessionUser.id });
      return { user: null, reason: 'account_pending' };
    }
    if (status === 'blocked' || status === 'suspended' || status === 'inactive') {
      console.debug('[XDrive Auth] auth resolution failed', { reason: 'account_blocked', userId: sessionUser.id });
      return { user: null, reason: 'account_blocked' };
    }
  }

  let companyId = membership?.company_id ?? driver?.company_id ?? profile?.company_id ?? creatorCompany?.id ?? null;

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

  const resolvedRole = resolveAuthoritativeRole({
    membershipRole: membership?.role_in_company ?? null,
    profileRole: profile?.role ?? null,
    isDriver: Boolean(driver) || profile?.is_driver === true,
    hasCreatedCompany: Boolean(creatorCompany),
    creatorCompanyType: creatorCompany?.company_type ?? null,
    fallbackRole,
  });

  if (resolvedRole) {
    if (roleRequiresCompanyContext(resolvedRole) && !companyId) {
      console.debug('[XDrive Auth] auth resolution failed', { reason: 'company_context_missing', resolvedRole, userId: sessionUser.id });
      return { user: null, reason: 'company_context_missing' };
    }
    return ok(sessionUser, resolvedRole, companyId, driverId, resolvedRole === 'driver' ? mustChangePassword : false);
  }

  if (profileDbError) {
    return { user: null, reason: 'db_error', dbError: profileDbError };
  }

  // 6. No profile at all and no other resolution path
  if (!profile) {
    console.debug('[XDrive Auth] auth resolution failed', { reason: 'profile_missing', userId: sessionUser.id });
    return { user: null, reason: 'profile_missing' };
  }

  // 7. Profile exists but role value is genuinely unrecognised
  console.debug('[XDrive Auth] auth resolution failed', { reason: 'role_unsupported', profileRole: profile?.role, userId: sessionUser.id });
  return { user: null, reason: 'role_unsupported' };
};

/** Build a successful AuthResolutionResult. */
const ok = (
  sessionUser: SessionUser,
  role: UserRole,
  companyId: string | null,
  driverId: string | null,
  mustChangePassword: boolean
): AuthResolutionResult => {
  const resolved: ResolvedAuthUser = {
    id: sessionUser.id,
    email: sessionUser.email ?? '',
    role,
    companyId,
    driverId,
    mustChangePassword,
  };
  console.debug('[XDrive Auth] resolved user', { role, companyId, userId: sessionUser.id });
  return { user: resolved, reason: null };
};

export const getPostLoginRoute = (currentUser: Pick<ResolvedAuthUser, 'role' | 'mustChangePassword'>) => {
  if (currentUser.role === 'driver') return currentUser.mustChangePassword ? '/driver/change-password' : '/driver/jobs';
  if (currentUser.role === 'customer') return '/customer';
  return '/admin';
};
