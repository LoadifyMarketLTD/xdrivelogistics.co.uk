import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from './app/api/_lib/supabaseAdmin';
import { resolveAuthContext, selectDeterministicMembership } from './lib/authContextResolver';
import { getPostLoginRoute } from './lib/authSession';
import { isRoleAllowedForPath, mapAppRole, type AppUserRole } from './lib/authRole';
import { ROUTE_AUTH_COOKIE_NAME } from './lib/routeAuthCookie';
import { getCanonicalSiteUrl } from './lib/siteUrl';
import { resolveWorkspaceRole, type WorkspaceRole } from './lib/workspaceRole';

const DRIVER_PATH = '/driver';
const DRIVER_JOBS_PATH = '/driver/jobs';
const DRIVER_CHANGE_PASSWORD_PATH = '/driver/change-password';
const FORBIDDEN_PATH = '/forbidden';
const LOGIN_PATH = '/login';
const PROTECTED_PATH_PREFIXES = ['/super-admin', '/broker', '/admin', '/driver', '/customer', '/m'];

type RouteAuthResult =
  | { kind: 'unauthenticated' }
  | { kind: 'service_unavailable' }
  | { kind: 'forbidden' }
  | {
      kind: 'authenticated';
      role: AppUserRole;
      rawRole: string | null;
      workspaceRole: WorkspaceRole;
      mustChangePassword: boolean;
      appAccess: boolean | null;
      ownerDriverWorkspace: boolean;
      ownerDriverExecutionMode: boolean;
      canAccessDriverMode: boolean;
      membershipRole: string | null;
    };

const buildRedirect = (request: NextRequest, pathname: string, clearCookie = false) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  const response = NextResponse.redirect(url);
  if (clearCookie) {
    response.cookies.set({
      name: ROUTE_AUTH_COOKIE_NAME,
      value: '',
      maxAge: 0,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
};

const buildLoginRedirect = (request: NextRequest, reason?: string) => {
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = '';

  const nextUrl = request.nextUrl.clone();
  nextUrl.searchParams.delete('mock-dashboard');
  const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
  if (nextPath && nextPath !== LOGIN_PATH) url.searchParams.set('next', nextPath);
  if (reason) url.searchParams.set('reason', reason);

  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: ROUTE_AUTH_COOKIE_NAME,
    value: '',
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
};

const readMetadataText = (metadata: Record<string, unknown> | null | undefined, key: string) => {
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

const isOwnerDriverWorkspaceRequested = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined
) => {
  const tags = [
    readMetadataText(userMetadata, 'account_type'),
    readMetadataText(userMetadata, 'workspace_mode'),
    readMetadataText(userMetadata, 'requested_role'),
    readMetadataText(userMetadata, 'role'),
    readMetadataText(appMetadata, 'account_type'),
    readMetadataText(appMetadata, 'workspace_mode'),
    readMetadataText(appMetadata, 'requested_role'),
    readMetadataText(appMetadata, 'role'),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().trim());

  return (
    readMetadataFlag(userMetadata, 'owner_driver_workspace') ||
    readMetadataFlag(appMetadata, 'owner_driver_workspace') ||
    tags.some((value) =>
      [
        'owner_driver',
        'owner-driver',
        'owner_operator',
        'owner-operator',
        'self_employed',
        'self-employed',
        'self_employed_driver',
        'sole_trader',
      ].includes(value)
    )
  );
};

const isOwnerDriverExecutionModeRequested = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined
) => {
  const tags = [
    readMetadataText(userMetadata, 'workspace_mode'),
    readMetadataText(userMetadata, 'execution_mode'),
    readMetadataText(appMetadata, 'workspace_mode'),
    readMetadataText(appMetadata, 'execution_mode'),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().trim());

  return (
    readMetadataFlag(userMetadata, 'owner_driver_execution_mode') ||
    readMetadataFlag(appMetadata, 'owner_driver_execution_mode') ||
    tags.some((value) => value === 'driver' || value === 'driver_mode' || value === 'execution')
  );
};

const isServiceFailure = (message: string | null | undefined) => {
  const normalized = (message ?? '').toLowerCase();
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('fetch') ||
    normalized.includes('503')
  );
};

const canonicalSiteUrl = getCanonicalSiteUrl();
const canonicalHost = canonicalSiteUrl.host.toLowerCase();

const shouldEnforceCanonicalHost = () =>
  process.env.NODE_ENV === 'production' || process.env.XDRIVE_FORCE_CANONICAL_HOST === 'true';

const normalizeHost = (host: string) => host.replace(/:\d+$/, '').replace(/^\[(.*)\]$/, '$1').toLowerCase();
const isLocalTestHost = (host: string) => ['localhost', '127.0.0.1', '::1'].includes(normalizeHost(host));
const isNetlifyPreviewHost = (host: string) =>
  host.endsWith('.netlify.app') &&
  (host.startsWith('deploy-preview-') || host.startsWith('branch-') || host.includes('--'));

const isProtectedPath = (pathname: string) =>
  PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const buildCanonicalHostRedirect = (request: NextRequest) => {
  if (!shouldEnforceCanonicalHost()) return null;
  const incomingHost = request.headers.get('host')?.toLowerCase();
  if (!incomingHost || incomingHost === canonicalHost || isLocalTestHost(incomingHost) || isNetlifyPreviewHost(incomingHost)) {
    return null;
  }
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.protocol = canonicalSiteUrl.protocol;
  redirectUrl.host = canonicalHost;
  redirectUrl.port = '';
  return NextResponse.redirect(redirectUrl, 308);
};

const resolveRouteAuth = async (request: NextRequest): Promise<RouteAuthResult> => {
  const accessToken = request.cookies.get(ROUTE_AUTH_COOKIE_NAME)?.value?.trim();
  if (!accessToken || !supabaseValidator) return { kind: 'unauthenticated' };

  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(accessToken);
  if (authError && isServiceFailure(authError.message)) return { kind: 'service_unavailable' };
  if (authError || !authData.user) return { kind: 'unauthenticated' };

  const fallbackRole = readMetadataText(
    authData.user.app_metadata as Record<string, unknown> | null | undefined,
    'role'
  );
  const userMetadata = authData.user.user_metadata as Record<string, unknown> | null | undefined;
  const appMetadata = authData.user.app_metadata as Record<string, unknown> | null | undefined;
  const ownerDriverWorkspace = isOwnerDriverWorkspaceRequested(userMetadata, appMetadata);
  const ownerDriverExecutionMode = isOwnerDriverExecutionModeRequested(userMetadata, appMetadata);

  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    const role = mapAppRole(fallbackRole);
    return role
      ? {
          kind: 'authenticated',
          role,
          rawRole: fallbackRole,
          workspaceRole: resolveWorkspaceRole({ role, rawRole: fallbackRole, ownerDriverWorkspace }),
          mustChangePassword: false,
          appAccess: null,
          ownerDriverWorkspace,
          ownerDriverExecutionMode,
          canAccessDriverMode: ownerDriverWorkspace && role === 'driver',
          membershipRole: null,
        }
      : { kind: 'forbidden' };
  }

  const [profileRes, membershipRes, driverRes, creatorCompanyRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('role, status, is_driver, company_id')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('id, company_id, role_in_company, status, created_at')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('drivers')
      .select('app_access, must_change_password, company_id')
      .eq('user_id', authData.user.id)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('companies')
      .select('id, company_type')
      .eq('created_by', authData.user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    isServiceFailure(profileRes.error?.message) ||
    isServiceFailure(membershipRes.error?.message) ||
    isServiceFailure(driverRes.error?.message) ||
    isServiceFailure(creatorCompanyRes.error?.message)
  ) {
    return { kind: 'service_unavailable' };
  }

  const profile = profileRes.error
    ? null
    : (profileRes.data as {
        role?: string | null;
        status?: string | null;
        is_driver?: boolean | null;
        company_id?: string | null;
      } | null);
  const memberships = membershipRes.error
    ? []
    : ((membershipRes.data ?? []) as Array<{
        id?: string | null;
        company_id?: string | null;
        role_in_company?: string | null;
        status?: string | null;
        created_at?: string | null;
      }>);
  const membership = selectDeterministicMembership(memberships, profile?.company_id ?? null);
  const driver = driverRes.error
    ? null
    : (driverRes.data as {
        app_access?: boolean | null;
        must_change_password?: boolean | null;
        company_id?: string | null;
      } | null);
  const creatorCompany = creatorCompanyRes.error
    ? null
    : (creatorCompanyRes.data as { id?: string | null; company_type?: string | null } | null);

  const profileStatus = profile?.status?.toLowerCase();
  if (profileStatus === 'pending' || profileStatus === 'blocked' || profileStatus === 'suspended' || profileStatus === 'inactive') {
    return { kind: 'forbidden' };
  }

  const resolvedContext = resolveAuthContext({
    membershipRole: membership?.role_in_company ?? null,
    profileRole: profile?.role ?? null,
    isDriver: driver != null || profile?.is_driver === true,
    creatorCompanyId: creatorCompany?.id ?? null,
    creatorCompanyType: creatorCompany?.company_type ?? null,
    fallbackRole,
    ownerDriverWorkspaceRequested: ownerDriverWorkspace,
    profileCompanyId: profile?.company_id ?? null,
    membershipCompanyId: membership?.company_id ?? null,
    driverCompanyId: driver?.company_id ?? null,
    mustChangePassword: driver?.must_change_password === true,
  });

  if (!resolvedContext.role) return { kind: 'forbidden' };

  const role = resolvedContext.role;
  const canAccessDriverMode =
    ownerDriverWorkspace &&
    (driver != null ||
      profile?.is_driver === true ||
      mapAppRole(profile?.role ?? null) === 'driver' ||
      mapAppRole(fallbackRole) === 'driver');
  const rawRole = profile?.role ?? fallbackRole ?? null;
  const workspaceRole = resolveWorkspaceRole({
    role,
    rawRole,
    membershipRole: membership?.role_in_company ?? null,
    ownerDriverWorkspace,
  });

  return {
    kind: 'authenticated',
    role,
    rawRole,
    workspaceRole,
    mustChangePassword: (role === 'driver' || canAccessDriverMode) && driver?.must_change_password === true,
    appAccess: role === 'driver' || canAccessDriverMode ? (driver?.app_access ?? null) : null,
    ownerDriverWorkspace,
    ownerDriverExecutionMode,
    canAccessDriverMode,
    membershipRole: membership?.role_in_company ?? null,
  };
};

export async function middleware(request: NextRequest) {
  const canonicalRedirect = buildCanonicalHostRedirect(request);
  if (canonicalRedirect) return canonicalRedirect;
  if (!isProtectedPath(request.nextUrl.pathname)) return NextResponse.next();

  const auth = await resolveRouteAuth(request);
  if (auth.kind === 'unauthenticated') return buildLoginRedirect(request);
  if (auth.kind === 'service_unavailable') return buildLoginRedirect(request, 'service_unavailable');
  if (auth.kind === 'forbidden') return buildRedirect(request, FORBIDDEN_PATH);

  const url = request.nextUrl.clone();
  const hasMockDashboardParam =
    url.pathname === DRIVER_JOBS_PATH &&
    (url.searchParams.get('mock-dashboard') === '1' || url.searchParams.has('mock-dashboard'));
  const driverRouteRequested = url.pathname === DRIVER_PATH || url.pathname.startsWith('/driver/');
  const driverModeActive = auth.role === 'driver' || (auth.canAccessDriverMode && driverRouteRequested);

  if (driverModeActive) {
    if (auth.appAccess === false) return buildRedirect(request, FORBIDDEN_PATH);
    if (auth.mustChangePassword && url.pathname !== DRIVER_CHANGE_PASSWORD_PATH) {
      return buildRedirect(request, DRIVER_CHANGE_PASSWORD_PATH);
    }
  }

  if (url.pathname === '/admin' && (auth.workspaceRole === 'driver' || auth.workspaceRole === 'owner_driver')) {
    return buildRedirect(request, '/driver');
  }
  if (url.pathname === DRIVER_PATH && auth.mustChangePassword) {
    return buildRedirect(request, DRIVER_CHANGE_PASSWORD_PATH);
  }

  if (!isRoleAllowedForPath(url.pathname, auth.role, {
    canAccessDriverMode: auth.canAccessDriverMode,
    membershipRole: auth.membershipRole,
    ownerDriverWorkspace: auth.ownerDriverWorkspace,
    rawRole: auth.rawRole,
    workspaceRole: auth.workspaceRole,
  })) {
    const canonicalPath = getPostLoginRoute({
      role: auth.role,
      rawRole: auth.rawRole,
      workspaceRole: auth.workspaceRole,
      membershipRole: auth.membershipRole,
      mustChangePassword: auth.mustChangePassword,
      ownerDriverWorkspace: auth.ownerDriverWorkspace,
      canAccessDriverMode: auth.canAccessDriverMode,
      ownerDriverExecutionMode: auth.ownerDriverExecutionMode,
    });
    return canonicalPath !== url.pathname
      ? buildRedirect(request, canonicalPath)
      : buildRedirect(request, FORBIDDEN_PATH);
  }

  if (hasMockDashboardParam) return buildRedirect(request, DRIVER_JOBS_PATH);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};
