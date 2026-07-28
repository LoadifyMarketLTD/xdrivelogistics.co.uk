import {
  isRoleAllowedForPath,
  mapAppRole,
  normalizeProfileRoleForStorage,
  roleRequiresCompanyContext,
  shouldAutoProvisionCompany,
} from './authRole';
import {
  findScopedDriverEvidence,
  hasScopedDriverBootstrapEvidence,
  resolveSafeBootstrapProfileRole,
} from './bootstrapProfileRole';
import {
  normalizeAuthMembershipRows,
  resolveAuthActiveCompanySelection,
  type AuthMembershipQueryRow,
} from './authActiveCompanyContext';
import type { RawMembershipRow } from './activeWorkspace';
import { resolveAuthContext } from './authContextResolver';
import { isDriverExecutionModeRequested, isDriverProviderWorkspaceRequested } from './driverWorkspaceMode';
import { resolveMembershipRole, type MembershipRole } from './membershipRole';
import { supabase } from './supabaseClient';
import type { Driver, Profile } from './types/database';
import { getWorkspaceHomeRoute, resolveWorkspaceRole, type WorkspaceRole } from './workspaceRole';

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
  rawRole: string | null;
  workspaceRole: WorkspaceRole;
  companyId: string | null;
  membershipId: string | null;
  membershipRole: MembershipRole | null;
  driverId: string | null;
  mustChangePassword: boolean;
  ownerDriverWorkspace: boolean;
  canAccessDriverMode: boolean;
  ownerDriverExecutionMode: boolean;
  financeAccess: 'full' | 'limited' | 'hidden';
  driverType: string | null;
  canCommercialBid: boolean;
  driverStatus: string | null;
  appAccess: boolean | null;
  accountStatus: string | null;
  companyStatus: string | null;
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

const isMissingDriverCommercialColumn = (error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null | undefined) => {
  if (!error || error.code !== '42703') return false;
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return text.includes('driver_type') || text.includes('can_commercial_bid');
};

export const getFallbackRole = (sessionUser: SessionUser) =>
  readMetadataRole(sessionUser.app_metadata, 'role');

const resolveFinanceAccess = (
  role: UserRole,
  membershipRole: MembershipRole | null,
  sessionUser: SessionUser
): 'full' | 'limited' | 'hidden' => {
  if (role === 'owner' || role === 'company_admin') return 'full';
  if (role !== 'company_staff') return 'hidden';
  if (membershipRole === 'finance') return 'full';

  const explicitFinanceFlag =
    readMetadataFlag(sessionUser.app_metadata, 'finance_view') ||
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
  const ownerDriverWorkspaceRequested = isDriverProviderWorkspaceRequested(sessionUser.user_metadata, sessionUser.app_metadata);
  const ownerDriverExecutionModeRequested = isDriverExecutionModeRequested(sessionUser.user_metadata, sessionUser.app_metadata);
  const profileLookupQuery = `profiles.select(role,status,is_driver,company_id).eq(user_id,${sessionUser.id}).maybeSingle()`;
  const membershipLookupQuery =
    `company_memberships.select(id,company_id,user_id,role_in_company,status,companies(id,name,company_type,status)).eq(user_id,${sessionUser.id}).eq(status,active).order(created_at desc)`;
  const driverLookupQuery =
<<<<<<< HEAD
    `drivers.select(id,company_id,user_id,must_change_password,status,app_access,driver_type,can_commercial_bid).eq(user_id,${sessionUser.id})`;
=======
    `drivers.select(id,company_id,user_id,must_change_password,status,app_access,driver_type,can_commercial_bid).eq(user_id,${sessionUser.id}).limit(1).maybeSingle()`;
  const driverLookupLegacyQuery =
    `drivers.select(id,company_id,user_id,must_change_password,status,app_access).eq(user_id,${sessionUser.id}).limit(1).maybeSingle()`;
>>>>>>> origin/main
  const creatorCompanyLookupQuery =
    `companies.select(id,company_type).eq(created_by,${sessionUser.id}).limit(1).maybeSingle()`;
  const [profileRes, membershipResInitial, driverResInitial, creatorCompanyRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, status, is_driver, company_id')
      .eq('user_id', sessionUser.id)
      .maybeSingle(),
    supabase
      .from('company_memberships')
      .select('id, company_id, user_id, role_in_company, status, companies(id, name, company_type, status)')
      .eq('user_id', sessionUser.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('drivers')
      .select('id, company_id, user_id, must_change_password, status, app_access, driver_type, can_commercial_bid')
      .eq('user_id', sessionUser.id)
      .returns<Pick<Driver, 'id' | 'company_id' | 'user_id' | 'must_change_password' | 'status' | 'app_access' | 'driver_type' | 'can_commercial_bid'>[]>(),
    supabase
      .from('companies')
      .select('id, company_type')
      .eq('created_by', sessionUser.id)
      .limit(1)
      .maybeSingle(),
  ]);
  let usedLegacyDriverFallback = false;
  let driverLookupQueryUsed = driverLookupQuery;
  const shouldRetryDriverLookupWithLegacyColumns = driverResInitial.error && isMissingDriverCommercialColumn(driverResInitial.error);
  const driverRes = shouldRetryDriverLookupWithLegacyColumns
    ? await supabase
        .from('drivers')
        .select('id, company_id, user_id, must_change_password, status, app_access')
        .eq('user_id', sessionUser.id)
        .limit(1)
        .maybeSingle()
    : driverResInitial;
  if (shouldRetryDriverLookupWithLegacyColumns) {
    usedLegacyDriverFallback = true;
    driverLookupQueryUsed = driverLookupLegacyQuery;
  }

  // If the membership query failed (e.g. created_at column missing → HTTP 400),
  // retry without ORDER BY so transient schema mismatches don't zero out membershipId.
  const membershipRes = membershipResInitial.error
    ? await supabase
        .from('company_memberships')
        .select('id, company_id, user_id, role_in_company, status, companies(id, name, company_type, status)')
        .eq('user_id', sessionUser.id)
        .eq('status', 'active')
    : membershipResInitial;

  const toDbError = (
    query: string,
    error: {
      message: string;
      code?: string | null;
      details?: string | null;
      hint?: string | null;
    }
  ): AuthDbError => ({
    query,
    message: error.message,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });

  const profileDbError = profileRes.error
    ? toDbError(profileLookupQuery, profileRes.error)
    : null;

  if (membershipRes.error) {
    return {
      user: null,
      reason: 'db_error',
      dbError: toDbError(membershipLookupQuery, membershipRes.error),
    };
  }

<<<<<<< HEAD
  if (profileDbError) {
    return { user: null, reason: 'db_error', dbError: profileDbError };
  }

  if (driverRes.error) {
    return {
      user: null,
      reason: 'db_error',
      dbError: toDbError(driverLookupQuery, driverRes.error),
    };
  }

  if (creatorCompanyRes.error) {
    return {
      user: null,
      reason: 'db_error',
      dbError: toDbError(creatorCompanyLookupQuery, creatorCompanyRes.error),
    };
=======
  if (membershipRes.error || driverRes.error || creatorCompanyRes.error) {
    console.debug('[XDrive Auth] profile lookup partial_error', {
      userId: sessionUser.id,
      membershipQuery: membershipLookupQuery,
      membershipErr: membershipRes.error?.message,
      driverQuery: driverLookupQueryUsed,
      driverErr: driverRes.error?.message,
      creatorCompanyQuery: creatorCompanyLookupQuery,
      creatorCompanyErr: creatorCompanyRes.error?.message,
    });
>>>>>>> origin/main
  }

  let profile = profileDbError
    ? null
    : (profileRes.data as Pick<Profile, 'role' | 'status' | 'is_driver' | 'company_id'> | null);
<<<<<<< HEAD
  const normalizedMemberships = membershipRes.error
    ? []
    : normalizeAuthMembershipRows((membershipRes.data ?? []) as AuthMembershipQueryRow[]);
  let membership = null as RawMembershipRow | null;
  if (normalizedMemberships.length > 0) {
    const companySelection = resolveAuthActiveCompanySelection({
      memberships: normalizedMemberships,
      preferredCompanyId: profile?.company_id ?? null,
    });

    if (!companySelection.ok) {
      return { user: null, reason: 'company_context_missing' };
    }

    membership = companySelection.membership;
  }
  const driverRows = driverRes.error
    ? []
    : ((driverRes.data ?? []) as Pick<Driver, 'id' | 'company_id' | 'user_id' | 'must_change_password' | 'status' | 'app_access' | 'driver_type' | 'can_commercial_bid'>[]);
=======
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
  if (driverRes.error) {
    return {
      user: null,
      reason: 'db_error',
      dbError: {
        query: driverLookupQueryUsed,
        message: driverRes.error.message,
        code: driverRes.error.code ?? null,
        details: driverRes.error.details ?? null,
        hint: driverRes.error.hint ?? null,
      },
    };
  }

  type DriverAuthRow = Pick<Driver, 'id' | 'company_id' | 'user_id' | 'must_change_password' | 'status' | 'app_access'>
    & Partial<Pick<Driver, 'driver_type' | 'can_commercial_bid'>>;
  const driver = driverRes.data as DriverAuthRow | null;
>>>>>>> origin/main
  const creatorCompany = creatorCompanyRes.error
    ? null
    : (creatorCompanyRes.data as { id: string; company_type: string | null } | null);

  console.debug('[XDrive Auth] profile lookup', {
    userId: sessionUser.id,
    profileRole: profile?.role ?? null,
    profileStatus: profile?.status ?? null,
    membershipRole: membership?.role_in_company ?? null,
    membershipId: membership?.id ?? null,
    membershipCompanyId: membership?.company_id ?? null,
    hasDriver: driverRows.length > 0,
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

  let companyId = membership?.company_id ?? profile?.company_id ?? creatorCompany?.id ?? null;
  const isStandaloneDriverAccount =
    !companyId &&
    !membership?.company_id &&
    driverRows.length > 0 &&
    !creatorCompany?.id &&
    (
      profile?.is_driver === true ||
      mapAppRole(profile?.role ?? null) === 'driver' ||
      mapAppRole(fallbackRole) === 'driver' ||
      driverRows.length > 0
    );

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
    !isStandaloneDriverAccount &&
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
    !isStandaloneDriverAccount &&
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
        .select('id, company_id, user_id, role_in_company, status, companies(id, name, company_type, status)')
        .eq('user_id', sessionUser.id)
        .eq('company_id', bootstrappedId)
        .eq('status', 'active')
        .limit(1);
      if (!freshMembershipRes.error && freshMembershipRes.data?.length) {
        const refreshed = normalizeAuthMembershipRows(
          freshMembershipRes.data as AuthMembershipQueryRow[],
        );
        membership = refreshed[0] ?? membership;
      }
    }
  }

  const activeMembershipCompanyIds = normalizedMemberships.map((membershipRow) => membershipRow.company_id);
  const bootstrapScopedDriverEvidence = findScopedDriverEvidence({
    drivers: driverRows,
    sessionUserId: sessionUser.id,
    selectedCompanyId: companyId,
  });
  const hasScopedDriverEvidenceForBootstrap = hasScopedDriverBootstrapEvidence({
    drivers: driverRows,
    sessionUserId: sessionUser.id,
    selectedCompanyId: companyId,
    activeMembershipCompanyIds,
  });

  if (!profile) {
    const safeBootstrapRole = resolveSafeBootstrapProfileRole({
      membershipRole: membership?.role_in_company ?? null,
      hasScopedDriver: hasScopedDriverEvidenceForBootstrap,
      fallbackRole,
    });
    const storedRole = normalizeProfileRoleForStorage(safeBootstrapRole) ?? 'customer';
    const profileBootstrap = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: sessionUser.id,
          role: storedRole,
          status: 'active',
          is_driver: safeBootstrapRole === 'driver',
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
    isDriver: driverRows.length > 0 || profile?.is_driver === true,
    creatorCompanyType: creatorCompany?.company_type ?? null,
    fallbackRole,
    profileCompanyId: profile?.company_id ?? null,
    membershipCompanyId: membership?.company_id ?? null,
    driverCompanyId: bootstrapScopedDriverEvidence?.company_id ?? null,
    creatorCompanyId: creatorCompany?.id ?? null,
    mustChangePassword: bootstrapScopedDriverEvidence?.must_change_password === true,
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
      ? (normalizedMemberships.find((m) => m.company_id === companyId) ?? membership)
      : membership;
  const resolvedMembershipRole = resolveMembershipRole(resolvedMembership?.role_in_company ?? null);
  if (resolvedMembership?.role_in_company && !resolvedMembershipRole) {
    console.debug('[XDrive Auth] auth resolution failed', {
      reason: 'role_unsupported',
      membershipRole: resolvedMembership.role_in_company,
      userId: sessionUser.id,
    });
    return { user: null, reason: 'role_unsupported' };
  }
  const scopedDriver = findScopedDriverEvidence({
    drivers: driverRows,
    sessionUserId: sessionUser.id,
    selectedCompanyId: companyId,
  });
  const scopedDriverId = scopedDriver?.id ?? null;
  const scopedMustChangePassword = scopedDriver?.must_change_password === true;
  const scopedOwnerDriverWorkspace = ownerDriverWorkspaceRequested && Boolean(scopedDriverId);
  const scopedOwnerDriverExecutionMode = scopedOwnerDriverWorkspace && ownerDriverExecutionModeRequested;
  const scopedCanAccessDriverMode =
    Boolean(scopedDriverId) &&
    (scopedDriver?.status ?? '').toLowerCase() === 'active' &&
    scopedDriver?.app_access === true;

  if (resolvedRole) {
    const accountStatus = profile?.status ? String(profile.status).trim().toLowerCase() : null;
    let companyStatus: string | null = null;
    const requiresCompanyContext = roleRequiresCompanyContext(resolvedRole);
    if (requiresCompanyContext && !companyId) {
      console.debug('[XDrive Auth] auth resolution failed', { reason: 'company_context_missing', resolvedRole, userId: sessionUser.id });
      return { user: null, reason: 'company_context_missing' };
    }

    if (companyId) {
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

      companyStatus = String(companyStatusRes.data?.status ?? '').trim().toLowerCase();
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
      resolvedMembershipRole,
      scopedDriverId,
      resolvedRole === 'driver' ? scopedMustChangePassword : false,
      {
        rawRole: profile?.role ?? fallbackRole ?? null,
        ownerDriverWorkspace: scopedOwnerDriverWorkspace,
        canAccessDriverMode: scopedCanAccessDriverMode,
        ownerDriverExecutionMode: scopedOwnerDriverExecutionMode,
        financeAccess: resolveFinanceAccess(
          resolvedRole,
          resolvedMembershipRole,
          sessionUser
        ),
<<<<<<< HEAD
        driverType: typeof scopedDriver?.driver_type === 'string' ? scopedDriver.driver_type : null,
        canCommercialBid: scopedDriver?.can_commercial_bid === true,
        driverStatus: typeof scopedDriver?.status === 'string' ? scopedDriver.status : null,
        appAccess: typeof scopedDriver?.app_access === 'boolean' ? scopedDriver.app_access : null,
        accountStatus,
        companyStatus,
=======
        driverType: usedLegacyDriverFallback ? null : (typeof driver?.driver_type === 'string' ? driver.driver_type : null),
        canCommercialBid: usedLegacyDriverFallback ? false : driver?.can_commercial_bid === true,
        driverStatus: typeof driver?.status === 'string' ? driver.status : null,
        appAccess: typeof driver?.app_access === 'boolean' ? driver.app_access : null,
>>>>>>> origin/main
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
  membershipRole: MembershipRole | null,
  driverId: string | null,
  mustChangePassword: boolean,
  options: {
    rawRole: string | null;
    ownerDriverWorkspace: boolean;
    canAccessDriverMode: boolean;
    ownerDriverExecutionMode: boolean;
    financeAccess: 'full' | 'limited' | 'hidden';
    driverType: string | null;
    canCommercialBid: boolean;
    driverStatus: string | null;
    appAccess: boolean | null;
    accountStatus: string | null;
    companyStatus: string | null;
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
    driverType: options.driverType,
    canCommercialBid: options.canCommercialBid,
    driverStatus: options.driverStatus,
    appAccess: options.appAccess,
    accountStatus: options.accountStatus,
    companyStatus: options.companyStatus,
  };
  console.debug('[XDrive Auth] resolved user', { role, workspaceRole, companyId, userId: sessionUser.id });
  return { user: resolved, reason: null };
};

export const getPostLoginRoute = (
  currentUser: Pick<
    ResolvedAuthUser,
    'role' | 'mustChangePassword' | 'ownerDriverWorkspace' | 'canAccessDriverMode' | 'ownerDriverExecutionMode'
  > & {
    rawRole?: string | null;
    workspaceRole?: WorkspaceRole;
    membershipRole?: MembershipRole | null;
    financeAccess?: 'full' | 'limited' | 'hidden' | null;
  }
) => {
  if (currentUser.mustChangePassword && (currentUser.role === 'driver' || currentUser.canAccessDriverMode)) {
    return '/driver/change-password';
  }

  if (currentUser.workspaceRole) {
    return getWorkspaceHomeRoute({
      role: currentUser.role,
      rawRole: currentUser.rawRole ?? null,
      membershipRole: currentUser.membershipRole ?? null,
      ownerDriverWorkspace: currentUser.ownerDriverWorkspace,
      financeAccess: currentUser.financeAccess ?? null,
    });
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
    membershipRole?: MembershipRole | null;
    financeAccess?: 'full' | 'limited' | 'hidden' | null;
    ownerDriverWorkspace?: boolean | null;
    ownerDriverExecutionMode?: boolean | null;
    driverId?: string | null;
    canCommercialBid?: boolean | null;
    driverStatus?: string | null;
    appAccess?: boolean | null;
    accountStatus?: string | null;
    companyStatus?: string | null;
  },
  path: string
) =>
  isRoleAllowedForPath(path, mapAppRole(currentUser.role), {
    canAccessDriverMode: currentUser.canAccessDriverMode === true,
    membershipRole: currentUser.membershipRole ?? null,
    financeAccess: currentUser.financeAccess ?? null,
    ownerDriverWorkspace: currentUser.ownerDriverWorkspace === true,
    ownerDriverExecutionMode: currentUser.ownerDriverExecutionMode === true,
    driverId: currentUser.driverId ?? null,
    canCommercialBid: currentUser.canCommercialBid ?? null,
    driverStatus: currentUser.driverStatus ?? null,
    appAccess: currentUser.appAccess ?? null,
    accountStatus: currentUser.accountStatus ?? null,
    companyStatus: currentUser.companyStatus ?? null,
  });
