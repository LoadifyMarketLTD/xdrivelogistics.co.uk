import {
  isRoleAllowedForPath,
  mapAppRole,
  normalizeProfileRoleForStorage,
  roleRequiresCompanyContext,
  shouldAutoProvisionCompany,
} from './authRole';
import { resolveAuthContext } from './authContextResolver';
import { supabase } from './supabaseClient';
import type { CompanyMembership, Driver, Profile } from './types/database';

export type UserRole =
  | 'guest'
  | 'owner'
  | 'broker'
  | 'company_admin'
  | 'company_staff'
  | 'driver'
  | 'customer';

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
  membershipId: string | null;
  membershipRole: CompanyMembership['role_in_company'] | null;
  driverId: string | null;
  mustChangePassword: boolean;
  ownerDriverWorkspace: boolean;
  canAccessDriverMode: boolean;
  ownerDriverExecutionMode: boolean;
  financeAccess: 'full' | 'limited' | 'hidden';
};

const readMetadataRole = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const readMetadataFlag = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

export const getFallbackRole = (sessionUser: SessionUser) =>
  readMetadataRole(sessionUser.app_metadata, 'role');

const isOwnerDriverWorkspaceRequested = (sessionUser: SessionUser) => {
  const tags = [
    readMetadataRole(sessionUser.user_metadata, 'account_type'),
    readMetadataRole(sessionUser.user_metadata, 'workspace_mode'),
    readMetadataRole(sessionUser.user_metadata, 'requested_role'),
    readMetadataRole(sessionUser.user_metadata, 'role'),
    readMetadataRole(sessionUser.app_metadata, 'account_type'),
    readMetadataRole(sessionUser.app_metadata, 'workspace_mode'),
    readMetadataRole(sessionUser.app_metadata, 'requested_role'),
    readMetadataRole(sessionUser.app_metadata, 'role'),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().trim());

  return (
    readMetadataFlag(sessionUser.user_metadata, 'owner_driver_workspace') ||
    readMetadataFlag(sessionUser.app_metadata, 'owner_driver_workspace') ||
    tags.some((value) => value === 'owner_driver' || value === 'owner-driver' || value === 'sole_trader')
  );
};

const isOwnerDriverExecutionModeRequested = (sessionUser: SessionUser) => {
  const tags = [
    readMetadataRole(sessionUser.user_metadata, 'workspace_mode'),
    readMetadataRole(sessionUser.user_metadata, 'execution_mode'),
    readMetadataRole(sessionUser.app_metadata, 'workspace_mode'),
    readMetadataRole(sessionUser.app_metadata, 'execution_mode'),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().trim());

  return (
    readMetadataFlag(sessionUser.user_metadata, 'owner_driver_execution_mode') ||
    readMetadataFlag(sessionUser.app_metadata, 'owner_driver_execution_mode') ||
    tags.some((value) => value === 'driver' || value === 'driver_mode' || value === 'execution')
  );
};

const resolveFinanceAccess = (
  role: UserRole,
  membershipRole: CompanyMembership['role_in_company'] | null,
  sessionUser: SessionUser
): 'full' | 'limited' | 'hidden' => {
  if (role === 'owner' || role === 'company_admin') return 'full';
  if (role !== 'company_staff') return 'hidden';

  const explicitFinanceFlag =
    readMetadataFlag(sessionUser.user_metadata, 'finance_view') ||
    readMetadataFlag(sessionUser.app_metadata, 'finance_view') ||
    readMetadataFlag(sessionUser.user_metadata, 'dispatcher_finance_access') ||
    readMetadataFlag(sessionUser.app_metadata, 'dispatcher_finance_access');

  if (explicitFinanceFlag || membershipRole === 'dispatcher') return 'limited';
  return 'hidden';
};

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
  const ownerDriverWorkspaceRequested = isOwnerDriverWorkspaceRequested(sessionUser);
  const ownerDriverExecutionModeRequested = isOwnerDriverExecutionModeRequested(sessionUser);
  const profileLookupQuery = `profiles.select(role,status,is_driver,company_id).eq(user_id,${sessionUser.id}).maybeSingle()`;
  const membershipLookupQuery =
    `company_memberships.select(id,company_id,role_in_company,status).eq(user_id,${sessionUser.id}).eq(status,active).order(created_at desc)`;
  const driverLookupQuery =
    `drivers.select(id,company_id,user_id,must_change_password).eq(user_id,${sessionUser.id}).limit(1).maybeSingle()`;
  const creatorCompanyLookupQuery =
    `companies.select(id,company_type).eq(created_by,${sessionUser.id}).limit(1).maybeSingle()`;
  const [profileRes, membershipResInitial, driverRes, creatorCompanyRes] = await Promise.all([
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

  // If the membership query failed (e.g. created_at column missing → HTTP 400),
  // retry without ORDER BY so transient schema mismatches don't zero out membershipId.
  const membershipRes = membershipResInitial.error
    ? await supabase
        .from('company_memberships')
        .select('id, company_id, role_in_company, status')
        .eq('user_id', sessionUser.id)
        .eq('status', 'active')
    : membershipResInitial;

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

  let profile = profileDbError
    ? null
    : (profileRes.data as Pick<Profile, 'role' | 'status' | 'is_driver' | 'company_id'> | null);
  const memberships = membershipRes.error
    ? null
    : (membershipRes.data as Pick<CompanyMembership, 'id' | 'company_id' | 'role_in_company' | 'status'>[] | null);
  const membershipFromProfile = memberships?.find(
    (membership) =>
      typeof profile?.company_id === 'string' &&
      profile.company_id.length > 0 &&
      membership.company_id === profile.company_id
  );
  let membership = membershipFromProfile ?? memberships?.[0] ?? null;
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
    membershipId: membership?.id ?? null,
    membershipCompanyId: membership?.company_id ?? null,
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

  let companyId = profile?.company_id ?? membership?.company_id ?? driver?.company_id ?? creatorCompany?.id ?? null;

  const isMissingCompanyProvisionRpc = (error: { message?: string | null; details?: string | null; hint?: string | null } | null | undefined) => {
    if (!error) return false;
    const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
    return text.includes('get_or_create_company_for_user') && (
      text.includes('schema cache') ||
      text.includes('could not find the function') ||
      text.includes('not found')
    );
  };

  if (
    !companyId &&
    ownerDriverWorkspaceRequested &&
    (mapAppRole(profile?.role) === 'driver' || mapAppRole(fallbackRole) === 'driver')
  ) {
    const { data: ownerDriverCompanyId, error: ownerDriverProvisionError } =
      await supabase.rpc('bootstrap_owner_driver_workspace');
    if (typeof ownerDriverCompanyId === 'string' && ownerDriverCompanyId) {
      companyId = ownerDriverCompanyId;
    } else if (ownerDriverProvisionError && !isMissingCompanyProvisionRpc(ownerDriverProvisionError)) {
      console.debug('[XDrive Auth] bootstrap_owner_driver_workspace failed', {
        userId: sessionUser.id,
        message: ownerDriverProvisionError.message,
        details: ownerDriverProvisionError.details,
        hint: ownerDriverProvisionError.hint,
      });
    }
  }

  if (
    !companyId &&
    shouldAutoProvisionCompany({
      fallbackRole,
      profileRole: profile?.role,
    })
  ) {
    const { data: provisionedCompanyId, error: provisionError } = await supabase.rpc('get_or_create_company_for_user');
    if (typeof provisionedCompanyId === 'string' && provisionedCompanyId) {
      companyId = provisionedCompanyId;
    } else if (provisionError && !isMissingCompanyProvisionRpc(provisionError)) {
      console.debug('[XDrive Auth] get_or_create_company_for_user failed', {
        userId: sessionUser.id,
        message: provisionError.message,
        details: provisionError.details,
        hint: provisionError.hint,
      });
    }
  }

  // If we resolved a company from profiles.company_id but there is no matching
  // company_memberships row, RLS policies that call is_company_member() will
  // silently return 0 rows on every subsequent query (drivers, quotes, docs).
  // bootstrap_company_membership() creates the missing row safely.
  if (companyId && !membership?.company_id) {
    const { data: bootstrappedId } = await supabase.rpc('bootstrap_company_membership');
    if (typeof bootstrappedId === 'string' && bootstrappedId.length > 0) {
      companyId = bootstrappedId;
      // Re-fetch the newly created membership so resolvedMembership and
      // membershipId are populated for the rest of this auth resolution.
      const freshMembershipRes = await supabase
        .from('company_memberships')
        .select('id, company_id, role_in_company, status')
        .eq('user_id', sessionUser.id)
        .eq('company_id', bootstrappedId)
        .eq('status', 'active')
        .maybeSingle();
      if (!freshMembershipRes.error && freshMembershipRes.data) {
        membership = freshMembershipRes.data as Pick<CompanyMembership, 'id' | 'company_id' | 'role_in_company' | 'status'>;
      }
    }
  }

  if (!profile) {
    const metadataRole = readMetadataRole(sessionUser.user_metadata, 'role')
      ?? readMetadataRole(sessionUser.user_metadata, 'requested_role')
      ?? fallbackRole;
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

    if (!profileBootstrap.error && profileBootstrap.data) {
      profile = profileBootstrap.data as Pick<Profile, 'role' | 'status' | 'is_driver' | 'company_id'>;
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

  // Re-derive the membership that corresponds to the resolved companyId so that
  // membershipId and companyId always point to the same company. The earlier
  // selection of `membership` used profile.company_id as a hint which may differ
  // from the final resolved value when multiple active memberships exist.
  const resolvedMembership =
    companyId != null
      ? (memberships?.find((m) => m.company_id === companyId) ?? membership)
      : membership;

  if (resolvedRole) {
    if (roleRequiresCompanyContext(resolvedRole) && !companyId) {
      console.debug('[XDrive Auth] auth resolution failed', { reason: 'company_context_missing', resolvedRole, userId: sessionUser.id });
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
        return {
          user: null,
          reason: 'db_error',
          dbError: {
            query: `companies.select(status).eq(id,${companyId}).maybeSingle()`,
            message: companyStatusRes.error.message,
            code: companyStatusRes.error.code ?? null,
            details: companyStatusRes.error.details ?? null,
            hint: companyStatusRes.error.hint ?? null,
          },
        };
      }

      const companyStatus = String(companyStatusRes.data?.status ?? '').trim().toLowerCase();
      if (companyStatus !== 'active') {
        console.debug('[XDrive Auth] auth resolution failed', {
          reason: 'account_blocked',
          userId: sessionUser.id,
          companyId,
          companyStatus: companyStatus || null,
        });
        return { user: null, reason: 'account_blocked' };
      }
    }

    return ok(
      sessionUser,
      resolvedRole,
      companyId,
      resolvedMembership?.id ?? null,
      resolvedMembership?.role_in_company ?? null,
      driverId,
      resolvedRole === 'driver' ? mustChangePassword : false,
      {
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
          (resolvedMembership?.role_in_company as CompanyMembership['role_in_company'] | null) ?? null,
          sessionUser
        ),
      }
    );
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
  membershipId: string | null,
  membershipRole: CompanyMembership['role_in_company'] | null,
  driverId: string | null,
  mustChangePassword: boolean,
  options: {
    ownerDriverWorkspace: boolean;
    canAccessDriverMode: boolean;
    ownerDriverExecutionMode: boolean;
    financeAccess: 'full' | 'limited' | 'hidden';
  }
): AuthResolutionResult => {
  const resolved: ResolvedAuthUser = {
    id: sessionUser.id,
    email: sessionUser.email ?? '',
    role,
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
  console.debug('[XDrive Auth] resolved user', { role, companyId, userId: sessionUser.id });
  return { user: resolved, reason: null };
};

export const getPostLoginRoute = (
  currentUser: Pick<
    ResolvedAuthUser,
    'role' | 'mustChangePassword' | 'ownerDriverWorkspace' | 'canAccessDriverMode' | 'ownerDriverExecutionMode'
  >
) => {
  if (
    currentUser.ownerDriverWorkspace &&
    currentUser.canAccessDriverMode &&
    currentUser.ownerDriverExecutionMode
  ) {
    return currentUser.mustChangePassword ? '/driver/change-password' : '/driver/jobs';
  }
  if (currentUser.ownerDriverWorkspace && currentUser.canAccessDriverMode) {
    return '/admin/marketplace';
  }
  if (currentUser.role === 'driver') return currentUser.mustChangePassword ? '/driver/change-password' : '/driver/jobs';
  if (currentUser.role === 'owner') return '/super-admin';
  if (currentUser.role === 'broker') return '/broker';
  if (currentUser.role === 'customer') return '/customer';
  if (currentUser.role === 'company_staff') return '/admin/jobs';
  return '/admin';
};

export const roleCanAccessPath = (
  currentUser: Pick<ResolvedAuthUser, 'role'> & { canAccessDriverMode?: boolean },
  path: string
) =>
  isRoleAllowedForPath(path, mapAppRole(currentUser.role), {
    canAccessDriverMode: currentUser.canAccessDriverMode === true,
  });
