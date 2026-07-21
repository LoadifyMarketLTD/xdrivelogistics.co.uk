import { resolveAccountTypeFromMetadata, type AccountType } from './accountTypes';
import {
  isRoleAllowedForPath,
  mapAppRole,
  roleRequiresCompanyContext,
} from './authRole';
import { classifyAccessLifecycleStatus, normalizeAccessStatus } from './accessLifecycle';
import { resolveAuthContext } from './authContextResolver';
import { isDriverExecutionModeRequested, isDriverProviderWorkspaceRequested } from './driverWorkspaceMode';
import { supabase } from './supabaseClient';
import type { CompanyMembership, Driver, Profile } from './types/database';
import {
  getWorkspaceDefinition,
  getWorkspaceHomeRoute,
  resolveWorkspaceRole,
  type WorkspaceRole,
} from './workspaceRole';

export type UserRole =
  | 'guest'
  | 'owner'
  | 'broker'
  | 'company_admin'
  | 'company_staff'
  | 'driver'
  | 'customer';

export type AuthFailureReason =
  | 'profile_missing'
  | 'account_pending'
  | 'account_blocked'
  | 'role_unsupported'
  | 'company_context_missing'
  | 'db_error';

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
  rawRole: string | null;
  workspaceRole: WorkspaceRole;
  companyId: string | null;
  membershipId: string | null;
  membershipRole: CompanyMembership['role_in_company'] | null;
  driverId: string | null;
  mustChangePassword: boolean;
  ownerDriverWorkspace: boolean;
  canAccessDriverMode: boolean;
  ownerDriverExecutionMode: boolean;
  financeAccess: 'full' | 'limited' | 'hidden';
};

const readMetadataRole = (
  metadata: Record<string, unknown> | null | undefined,
  key: string
): string | null => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const readMetadataFlag = (
  metadata: Record<string, unknown> | null | undefined,
  key: string
): boolean => {
  const value = metadata?.[key];
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return ['true', '1', 'yes'].includes(value.toLowerCase().trim());
};

export const getFallbackRole = (sessionUser: SessionUser): string | null =>
  resolveAccountTypeFromMetadata(sessionUser.user_metadata, sessionUser.app_metadata)
  ?? readMetadataRole(sessionUser.app_metadata, 'role')
  ?? readMetadataRole(sessionUser.user_metadata, 'role')
  ?? readMetadataRole(sessionUser.user_metadata, 'requested_role')
  ?? readMetadataRole(sessionUser.user_metadata, 'account_type')
  ?? readMetadataRole(sessionUser.user_metadata, 'signup_type');

const dbErrorResult = (
  query: string,
  error: { message: string; code?: string | null; details?: string | null; hint?: string | null }
): AuthResolutionResult => ({
  user: null,
  reason: 'db_error',
  dbError: {
    query,
    message: error.message,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  },
});

const unsupportedStatusError = (
  query: string,
  entity: 'profile' | 'company',
  rawStatus: unknown
): AuthResolutionResult =>
  dbErrorResult(query, {
    message: `Unsupported ${entity} access status: ${normalizeAccessStatus(rawStatus) || '(empty)'}.`,
    code: 'unsupported_access_status',
    details: null,
    hint: 'Use an active, pending/review, or blocked lifecycle status.',
  });

const workspaceRoleForPublicAccount = (accountType: AccountType | null): WorkspaceRole | null => {
  if (accountType === 'customer') return 'customer';
  if (accountType === 'broker') return 'broker';
  if (accountType === 'fleet_operator') return 'company_owner';
  if (accountType === 'owner_driver') return 'owner_driver';
  return null;
};

const resolveFinanceAccess = (
  role: UserRole,
  membershipRole: CompanyMembership['role_in_company'] | null,
  sessionUser: SessionUser,
  ownerDriverWorkspace: boolean
): 'full' | 'limited' | 'hidden' => {
  if (ownerDriverWorkspace) return 'hidden';
  if (role === 'owner' || role === 'company_admin') return 'full';
  if (role !== 'company_staff') return 'hidden';
  if (membershipRole === 'finance') return 'full';

  const explicitFinanceFlag =
    readMetadataFlag(sessionUser.user_metadata, 'finance_view')
    || readMetadataFlag(sessionUser.app_metadata, 'finance_view')
    || readMetadataFlag(sessionUser.user_metadata, 'dispatcher_finance_access')
    || readMetadataFlag(sessionUser.app_metadata, 'dispatcher_finance_access');

  return explicitFinanceFlag || membershipRole === 'dispatcher' ? 'limited' : 'hidden';
};

const ok = (
  sessionUser: SessionUser,
  role: UserRole,
  companyId: string | null,
  membershipId: string | null,
  membershipRole: CompanyMembership['role_in_company'] | null,
  driverId: string | null,
  mustChangePassword: boolean,
  options: {
    rawRole: string | null;
    workspaceRoleOverride: WorkspaceRole | null;
    ownerDriverWorkspace: boolean;
    canAccessDriverMode: boolean;
    ownerDriverExecutionMode: boolean;
    financeAccess: 'full' | 'limited' | 'hidden';
  }
): AuthResolutionResult => {
  const workspaceRole = options.workspaceRoleOverride ?? resolveWorkspaceRole({
    role,
    rawRole: options.rawRole,
    membershipRole,
    ownerDriverWorkspace: options.ownerDriverWorkspace,
    financeAccess: options.financeAccess,
  });

  return {
    user: {
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      role,
      rawRole: options.rawRole,
      workspaceRole,
      companyId,
      membershipId,
      membershipRole,
      driverId,
      mustChangePassword,
      ownerDriverWorkspace: options.ownerDriverWorkspace,
      canAccessDriverMode: options.canAccessDriverMode,
      ownerDriverExecutionMode: options.ownerDriverExecutionMode,
      financeAccess: options.financeAccess,
    },
    reason: null,
  };
};

export const resolveAuthenticatedUser = async (
  sessionUser: SessionUser
): Promise<AuthResolutionResult> => {
  if (!sessionUser.id) {
    return dbErrorResult('auth-session-user-id', {
      message: 'Missing authenticated session user id.',
    });
  }

  const accountType = resolveAccountTypeFromMetadata(sessionUser.user_metadata, sessionUser.app_metadata);
  const fallbackRole = getFallbackRole(sessionUser);
  const ownerDriverWorkspaceFromMetadata = accountType === 'owner_driver' || isDriverProviderWorkspaceRequested(
    sessionUser.user_metadata,
    sessionUser.app_metadata
  );
  const ownerDriverExecutionModeRequested = isDriverExecutionModeRequested(
    sessionUser.user_metadata,
    sessionUser.app_metadata
  );

  const profileQuery = `profiles.select(role,status,is_driver,company_id).eq(user_id,${sessionUser.id}).maybeSingle()`;
  const membershipQuery = `company_memberships.select(id,company_id,role_in_company,status).eq(user_id,${sessionUser.id}).eq(status,active)`;
  const driverQuery = `drivers.select(id,company_id,user_id,must_change_password,app_access).eq(user_id,${sessionUser.id}).limit(1).maybeSingle()`;
  const companyQuery = `companies.select(id,company_type,status).eq(created_by,${sessionUser.id}).order(created_at desc).limit(1).maybeSingle()`;

  const [profileResult, membershipResult, driverResult, creatorCompanyResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, status, is_driver, company_id')
      .eq('user_id', sessionUser.id)
      .maybeSingle(),
    supabase
      .from('company_memberships')
      .select('id, company_id, role_in_company, status')
      .eq('user_id', sessionUser.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('drivers')
      .select('id, company_id, user_id, must_change_password, app_access')
      .eq('user_id', sessionUser.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('id, company_type, status')
      .eq('created_by', sessionUser.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) return dbErrorResult(profileQuery, profileResult.error);
  if (membershipResult.error) return dbErrorResult(membershipQuery, membershipResult.error);
  if (driverResult.error) return dbErrorResult(driverQuery, driverResult.error);
  if (creatorCompanyResult.error) return dbErrorResult(companyQuery, creatorCompanyResult.error);

  const profile = profileResult.data as Pick<Profile, 'role' | 'status' | 'is_driver' | 'company_id'> | null;
  if (!profile) return { user: null, reason: 'profile_missing' };

  const profileStatus = profile.status ?? '';
  const profileAccessState = classifyAccessLifecycleStatus(profileStatus);
  if (profileAccessState === 'pending') return { user: null, reason: 'account_pending' };
  if (profileAccessState === 'blocked') return { user: null, reason: 'account_blocked' };
  if (profileAccessState === 'unknown') {
    return unsupportedStatusError(profileQuery, 'profile', profileStatus);
  }

  const memberships = (membershipResult.data ?? []) as Pick<
    CompanyMembership,
    'id' | 'company_id' | 'role_in_company' | 'status'
  >[];
  const profileMembership = memberships.find(
    (membership) => profile.company_id && membership.company_id === profile.company_id
  );
  const membership = profileMembership ?? memberships[0] ?? null;
  const driver = driverResult.data as (Pick<Driver, 'id' | 'company_id' | 'user_id' | 'must_change_password'> & {
    app_access?: boolean | null;
  }) | null;
  const creatorCompany = creatorCompanyResult.data as {
    id: string;
    company_type: string | null;
    status: string | null;
  } | null;
  const normalizedCreatorCompanyType = (creatorCompany?.company_type ?? '').toLowerCase().trim();
  const ownerDriverWorkspace = ownerDriverWorkspaceFromMetadata
    || ['owner_driver', 'owner_operator'].includes(normalizedCreatorCompanyType)
    || (
      mapAppRole(profile.role) === 'driver'
      && membership?.role_in_company === 'owner'
      && Boolean(driver)
    );

  const context = resolveAuthContext({
    membershipRole: membership?.role_in_company ?? null,
    profileRole: profile.role ?? null,
    isDriver: Boolean(driver) || profile.is_driver === true,
    creatorCompanyType: creatorCompany?.company_type ?? null,
    fallbackRole,
    profileCompanyId: profile.company_id ?? null,
    membershipCompanyId: membership?.company_id ?? null,
    driverCompanyId: driver?.company_id ?? null,
    creatorCompanyId: creatorCompany?.id ?? null,
    mustChangePassword: driver?.must_change_password === true,
    ownerDriverWorkspaceRequested: ownerDriverWorkspace,
  });

  if (!context.role) return { user: null, reason: 'role_unsupported' };

  const resolvedRole = context.role as UserRole;
  const companyId = context.companyId;
  const isCustomerWorkspace = resolvedRole === 'customer';
  const requiresActiveCompany = roleRequiresCompanyContext(resolvedRole) || isCustomerWorkspace || ownerDriverWorkspace;

  if (requiresActiveCompany && (!companyId || !membership)) {
    return { user: null, reason: 'company_context_missing' };
  }

  if (requiresActiveCompany && companyId) {
    let companyStatus = creatorCompany?.id === companyId ? creatorCompany.status : null;
    if (creatorCompany?.id !== companyId) {
      const companyStatusQuery = `companies.select(status).eq(id,${companyId}).maybeSingle()`;
      const companyStatusResult = await supabase
        .from('companies')
        .select('status')
        .eq('id', companyId)
        .maybeSingle();
      if (companyStatusResult.error) return dbErrorResult(companyStatusQuery, companyStatusResult.error);
      companyStatus = companyStatusResult.data?.status ?? null;
    }

    const companyAccessState = classifyAccessLifecycleStatus(companyStatus);
    if (companyAccessState === 'pending') return { user: null, reason: 'account_pending' };
    if (companyAccessState === 'blocked') return { user: null, reason: 'account_blocked' };
    if (companyAccessState === 'unknown') {
      return unsupportedStatusError('companies.select(status)', 'company', companyStatus);
    }
  }

  if (ownerDriverWorkspace && driver?.app_access !== true) {
    return { user: null, reason: 'account_pending' };
  }

  const membershipRole = membership?.role_in_company ?? null;
  const financeAccess = resolveFinanceAccess(resolvedRole, membershipRole, sessionUser, ownerDriverWorkspace);
  const rawRole = accountType
    ?? (ownerDriverWorkspace ? 'owner_driver' : null)
    ?? (resolvedRole === 'broker' ? 'broker' : null)
    ?? fallbackRole
    ?? profile.role
    ?? null;
  const canAccessDriverMode = ownerDriverWorkspace && (
    Boolean(driver)
    || profile.is_driver === true
    || mapAppRole(profile.role) === 'driver'
    || mapAppRole(fallbackRole) === 'driver'
  );

  return ok(
    sessionUser,
    resolvedRole,
    companyId,
    membership?.id ?? null,
    membershipRole,
    driver?.id ?? null,
    resolvedRole === 'driver' ? driver?.must_change_password === true : false,
    {
      rawRole,
      workspaceRoleOverride: workspaceRoleForPublicAccount(accountType)
        ?? (ownerDriverWorkspace ? 'owner_driver' : null)
        ?? (resolvedRole === 'broker' ? 'broker' : null),
      ownerDriverWorkspace,
      canAccessDriverMode,
      ownerDriverExecutionMode: ownerDriverExecutionModeRequested,
      financeAccess,
    }
  );
};

export const getPostLoginRoute = (
  currentUser: Pick<
    ResolvedAuthUser,
    'role' | 'mustChangePassword' | 'ownerDriverWorkspace' | 'canAccessDriverMode' | 'ownerDriverExecutionMode'
  > & {
    rawRole?: string | null;
    workspaceRole?: WorkspaceRole;
    membershipRole?: string | null;
    financeAccess?: 'full' | 'limited' | 'hidden' | null;
  }
) => {
  if (
    currentUser.mustChangePassword
    && (currentUser.role === 'driver' || currentUser.canAccessDriverMode)
  ) {
    return '/driver/change-password';
  }

  if (currentUser.workspaceRole) {
    return getWorkspaceDefinition(currentUser.workspaceRole).homeHref;
  }

  return getWorkspaceHomeRoute({
    role: currentUser.role,
    rawRole: currentUser.rawRole ?? null,
    membershipRole: currentUser.membershipRole ?? null,
    ownerDriverWorkspace: currentUser.ownerDriverWorkspace,
    financeAccess: currentUser.financeAccess ?? null,
  });
};

export const roleCanAccessPath = (
  currentUser: Pick<ResolvedAuthUser, 'role'> & {
    rawRole?: string | null;
    workspaceRole?: WorkspaceRole | null;
    canAccessDriverMode?: boolean;
    membershipRole?: CompanyMembership['role_in_company'] | null;
    financeAccess?: 'full' | 'limited' | 'hidden' | null;
    ownerDriverWorkspace?: boolean | null;
  },
  path: string
) =>
  isRoleAllowedForPath(path, mapAppRole(currentUser.role), {
    rawRole: currentUser.rawRole ?? null,
    workspaceRole: currentUser.workspaceRole ?? null,
    canAccessDriverMode: currentUser.canAccessDriverMode === true,
    membershipRole: currentUser.membershipRole ?? null,
    financeAccess: currentUser.financeAccess ?? null,
    ownerDriverWorkspace: currentUser.ownerDriverWorkspace === true,
  });
