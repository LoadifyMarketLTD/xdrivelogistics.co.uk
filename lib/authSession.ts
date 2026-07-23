import {
  isRoleAllowedForPath,
  mapAppRole,
  normalizeProfileRoleForStorage,
  roleRequiresCompanyContext,
  shouldAutoProvisionCompany,
} from './authRole';
import {
  resolveAuthContext,
  selectDeterministicMembership,
} from './authContextResolver';
import {
  isDriverExecutionModeRequested,
  isDriverProviderWorkspaceRequested,
} from './driverWorkspaceMode';
import { supabase } from './supabaseClient';
import type { CompanyMembership, Driver, Profile } from './types/database';
import { resolveWorkspaceRawRole } from './workspaceIdentity';
import {
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
) => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const readMetadataFlag = (
  metadata: Record<string, unknown> | null | undefined,
  key: string
) => {
  const value = metadata?.[key];
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

export const getFallbackRole = (sessionUser: SessionUser) =>
  readMetadataRole(sessionUser.app_metadata, 'role');

const resolveFinanceAccess = (
  role: UserRole,
  membershipRole: CompanyMembership['role_in_company'] | null,
  sessionUser: SessionUser
): 'full' | 'limited' | 'hidden' => {
  if (role === 'owner' || role === 'company_admin') return 'full';
  if (role !== 'company_staff') return 'hidden';
  if (membershipRole === 'finance') return 'full';

  const explicitFinanceFlag =
    readMetadataFlag(sessionUser.user_metadata, 'finance_view') ||
    readMetadataFlag(sessionUser.app_metadata, 'finance_view') ||
    readMetadataFlag(sessionUser.user_metadata, 'dispatcher_finance_access') ||
    readMetadataFlag(sessionUser.app_metadata, 'dispatcher_finance_access');

  if (explicitFinanceFlag || membershipRole === 'dispatcher') return 'limited';
  return 'hidden';
};

const toDbError = (
  query: string,
  error: {
    message: string;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  }
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
  const ownerDriverWorkspaceRequested = isDriverProviderWorkspaceRequested(
    sessionUser.user_metadata,
    sessionUser.app_metadata
  );
  const ownerDriverExecutionModeRequested = isDriverExecutionModeRequested(
    sessionUser.user_metadata,
    sessionUser.app_metadata
  );
  const profileLookupQuery =
    `profiles.select(role,status,is_driver,company_id).eq(user_id,${sessionUser.id}).maybeSingle()`;
  const membershipLookupQuery =
    `company_memberships.select(id,company_id,role_in_company,status,created_at)` +
    `.eq(user_id,${sessionUser.id}).eq(status,active).order(created_at desc,id asc)`;
  const driverLookupQuery =
    `drivers.select(id,company_id,user_id,must_change_password).eq(user_id,${sessionUser.id}).limit(1).maybeSingle()`;
  const creatorCompanyLookupQuery =
    `companies.select(id,company_type).eq(created_by,${sessionUser.id}).limit(1).maybeSingle()`;

  const [profileRes, membershipRes, driverRes, creatorCompanyRes] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('role, status, is_driver, company_id')
        .eq('user_id', sessionUser.id)
        .maybeSingle(),
      supabase
        .from('company_memberships')
        .select('id, company_id, role_in_company, status, created_at')
        .eq('user_id', sessionUser.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }),
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

  if (profileRes.error) return toDbError(profileLookupQuery, profileRes.error);
  if (membershipRes.error) {
    return toDbError(membershipLookupQuery, membershipRes.error);
  }
  if (driverRes.error) return toDbError(driverLookupQuery, driverRes.error);
  if (creatorCompanyRes.error) {
    return toDbError(creatorCompanyLookupQuery, creatorCompanyRes.error);
  }

  let profile = profileRes.data as Pick<
    Profile,
    'role' | 'status' | 'is_driver' | 'company_id'
  > | null;
  const memberships = (membershipRes.data ?? []) as Array<
    Pick<
      CompanyMembership,
      'id' | 'company_id' | 'role_in_company' | 'status' | 'created_at'
    >
  >;
  let membership = selectDeterministicMembership(
    memberships,
    profile?.company_id ?? null
  );
  const driver = driverRes.data as Pick<
    Driver,
    'id' | 'company_id' | 'user_id' | 'must_change_password'
  > | null;
  const creatorCompany = creatorCompanyRes.data as {
    id: string;
    company_type: string | null;
  } | null;

  const driverId = driver?.id ?? null;
  const mustChangePassword = driver?.must_change_password === true;

  if (profile) {
    const status = (profile.status ?? 'active').toLowerCase();
    if (status === 'pending') {
      return { user: null, reason: 'account_pending' };
    }
    if (
      status === 'blocked' ||
      status === 'suspended' ||
      status === 'inactive'
    ) {
      return { user: null, reason: 'account_blocked' };
    }
  }

  let companyId =
    membership?.company_id ??
    profile?.company_id ??
    driver?.company_id ??
    creatorCompany?.id ??
    null;
  const isStandaloneDriverAccount =
    !companyId &&
    !membership?.company_id &&
    !driver?.company_id &&
    !creatorCompany?.id &&
    (profile?.is_driver === true ||
      mapAppRole(profile?.role ?? null) === 'driver' ||
      mapAppRole(fallbackRole) === 'driver' ||
      Boolean(driver));

  const isMissingCompanyProvisionRpc = (error: {
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  } | null | undefined) => {
    if (!error) return false;
    const text = `${error.message ?? ''} ${error.details ?? ''} ${
      error.hint ?? ''
    }`.toLowerCase();
    return (
      text.includes('get_or_create_company_for_user') &&
      (text.includes('schema cache') ||
        text.includes('could not find the function') ||
        text.includes('not found'))
    );
  };

  if (
    !companyId &&
    !isStandaloneDriverAccount &&
    ownerDriverWorkspaceRequested &&
    (mapAppRole(profile?.role) === 'driver' ||
      mapAppRole(fallbackRole) === 'driver')
  ) {
    const { data: ownerDriverCompanyId, error: ownerDriverProvisionError } =
      await supabase.rpc('bootstrap_owner_driver_workspace');
    if (typeof ownerDriverCompanyId === 'string' && ownerDriverCompanyId) {
      companyId = ownerDriverCompanyId;
    } else if (
      ownerDriverProvisionError &&
      !isMissingCompanyProvisionRpc(ownerDriverProvisionError)
    ) {
      return toDbError(
        'rpc.bootstrap_owner_driver_workspace',
        ownerDriverProvisionError
      );
    }
  }

  if (
    !companyId &&
    !isStandaloneDriverAccount &&
    shouldAutoProvisionCompany({
      fallbackRole,
      profileRole: profile?.role,
    })
  ) {
    const { data: provisionedCompanyId, error: provisionError } =
      await supabase.rpc('get_or_create_company_for_user');
    if (typeof provisionedCompanyId === 'string' && provisionedCompanyId) {
      companyId = provisionedCompanyId;
    } else if (provisionError && !isMissingCompanyProvisionRpc(provisionError)) {
      return toDbError('rpc.get_or_create_company_for_user', provisionError);
    }
  }

  if (companyId && !membership?.company_id) {
    const { data: bootstrappedId, error: membershipBootstrapError } =
      await supabase.rpc('bootstrap_company_membership');
    if (membershipBootstrapError) {
      return toDbError(
        'rpc.bootstrap_company_membership',
        membershipBootstrapError
      );
    }
    if (typeof bootstrappedId === 'string' && bootstrappedId.length > 0) {
      companyId = bootstrappedId;
      const freshMembershipRes = await supabase
        .from('company_memberships')
        .select('id, company_id, role_in_company, status, created_at')
        .eq('user_id', sessionUser.id)
        .eq('company_id', bootstrappedId)
        .eq('status', 'active')
        .maybeSingle();
      if (freshMembershipRes.error) {
        return toDbError(
          `company_memberships.select(...).eq(company_id,${bootstrappedId}).maybeSingle()`,
          freshMembershipRes.error
        );
      }
      if (freshMembershipRes.data) {
        membership = freshMembershipRes.data as Pick<
          CompanyMembership,
          'id' | 'company_id' | 'role_in_company' | 'status' | 'created_at'
        >;
      }
    }
  }

  if (!profile) {
    const metadataRole =
      readMetadataRole(sessionUser.user_metadata, 'role') ??
      readMetadataRole(sessionUser.user_metadata, 'requested_role') ??
      fallbackRole;
    const mappedRole = mapAppRole(metadataRole) ?? 'customer';
    const storedRole = normalizeProfileRoleForStorage(mappedRole) ?? 'customer';
    const profileBootstrap = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: sessionUser.id,
          role: storedRole,
          status: 'active',
          is_driver: mappedRole === 'driver',
        },
        { onConflict: 'user_id' }
      )
      .select('role, status, is_driver, company_id')
      .maybeSingle();

    if (profileBootstrap.error) {
      return toDbError('profiles.upsert(auth-bootstrap)', profileBootstrap.error);
    }
    if (profileBootstrap.data) {
      profile = profileBootstrap.data as Pick<
        Profile,
        'role' | 'status' | 'is_driver' | 'company_id'
      >;
    }
  }

  const resolvedContext = resolveAuthContext({
    membershipRole: membership?.role_in_company ?? null,
    profileRole: profile?.role ?? null,
    isDriver: Boolean(driver) || profile?.is_driver === true,
    creatorCompanyType: creatorCompany?.company_type ?? null,
    fallbackRole,
    profileCompanyId: profile?.company_id ?? null,
    membershipCompanyId: membership?.company_id ?? null,
    driverCompanyId: driver?.company_id ?? null,
    creatorCompanyId: creatorCompany?.id ?? null,
    mustChangePassword,
    ownerDriverWorkspaceRequested,
  });

  companyId = resolvedContext.companyId;
  const resolvedRole = resolvedContext.role;
  const resolvedMembership =
    companyId != null
      ? (memberships.find((item) => item.company_id === companyId) ?? membership)
      : membership;

  if (resolvedRole) {
    if (roleRequiresCompanyContext(resolvedRole) && !companyId) {
      return { user: null, reason: 'company_context_missing' };
    }

    if (roleRequiresCompanyContext(resolvedRole) && companyId) {
      const companyStatusRes = await supabase
        .from('companies')
        .select('status')
        .eq('id', companyId)
        .limit(1)
        .maybeSingle();

      if (companyStatusRes.error) {
        return toDbError(
          `companies.select(status).eq(id,${companyId}).maybeSingle()`,
          companyStatusRes.error
        );
      }

      const companyStatus = String(companyStatusRes.data?.status ?? '')
        .trim()
        .toLowerCase();
      if (companyStatus !== 'active') {
        return { user: null, reason: 'account_blocked' };
      }
    }

    const workspaceRawRole = resolveWorkspaceRawRole({
      profileRole: profile?.role ?? null,
      fallbackRole,
      userMetadata: sessionUser.user_metadata,
      appMetadata: sessionUser.app_metadata,
    });

    return ok(
      sessionUser,
      resolvedRole,
      companyId,
      resolvedMembership?.id ?? null,
      resolvedMembership?.role_in_company ?? null,
      driverId,
      resolvedRole === 'driver' ? mustChangePassword : false,
      {
        rawRole: workspaceRawRole,
        ownerDriverWorkspace: ownerDriverWorkspaceRequested,
        canAccessDriverMode:
          ownerDriverWorkspaceRequested &&
          (Boolean(driver) ||
            profile?.is_driver === true ||
            mapAppRole(profile?.role ?? null) === 'driver' ||
            mapAppRole(fallbackRole) === 'driver'),
        ownerDriverExecutionMode: ownerDriverExecutionModeRequested,
        financeAccess: resolveFinanceAccess(
          resolvedRole,
          (resolvedMembership?.role_in_company as
            | CompanyMembership['role_in_company']
            | null) ?? null,
          sessionUser
        ),
      }
    );
  }

  if (!profile) return { user: null, reason: 'profile_missing' };
  return { user: null, reason: 'role_unsupported' };
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
    ownerDriverWorkspace: boolean;
    canAccessDriverMode: boolean;
    ownerDriverExecutionMode: boolean;
    financeAccess: 'full' | 'limited' | 'hidden';
  }
): AuthResolutionResult => {
  const workspaceRole = resolveWorkspaceRole({
    role,
    rawRole: options.rawRole,
    membershipRole,
    ownerDriverWorkspace: options.ownerDriverWorkspace,
    financeAccess: options.financeAccess,
  });
  const resolved: ResolvedAuthUser = {
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
  };
  return { user: resolved, reason: null };
};

export const getPostLoginRoute = (
  currentUser: Pick<
    ResolvedAuthUser,
    | 'role'
    | 'mustChangePassword'
    | 'ownerDriverWorkspace'
    | 'canAccessDriverMode'
    | 'ownerDriverExecutionMode'
  > & {
    rawRole?: string | null;
    workspaceRole?: WorkspaceRole;
    membershipRole?: string | null;
    financeAccess?: 'full' | 'limited' | 'hidden' | null;
  }
) => {
  if (
    currentUser.mustChangePassword &&
    (currentUser.role === 'driver' || currentUser.canAccessDriverMode)
  ) {
    return '/driver/change-password';
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
    canAccessDriverMode?: boolean;
    membershipRole?: CompanyMembership['role_in_company'] | null;
    financeAccess?: 'full' | 'limited' | 'hidden' | null;
    ownerDriverWorkspace?: boolean | null;
  },
  path: string
) =>
  isRoleAllowedForPath(path, mapAppRole(currentUser.role), {
    canAccessDriverMode: currentUser.canAccessDriverMode === true,
    membershipRole: currentUser.membershipRole ?? null,
    financeAccess: currentUser.financeAccess ?? null,
    ownerDriverWorkspace: currentUser.ownerDriverWorkspace === true,
  });
