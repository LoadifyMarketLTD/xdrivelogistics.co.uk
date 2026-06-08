import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from './app/api/_lib/supabaseAdmin';
import { getPostLoginRoute } from './lib/authSession';
import { isRoleAllowedForPath, mapAppRole, resolveAuthoritativeRole, type AppUserRole } from './lib/authRole';
import { ROUTE_AUTH_COOKIE_NAME } from './lib/routeAuthCookie';
import { getCanonicalSiteUrl } from './lib/siteUrl';

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
      mustChangePassword: boolean;
      appAccess: boolean | null;
      ownerDriverWorkspace: boolean;
      ownerDriverExecutionMode: boolean;
      canAccessDriverMode: boolean;
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
  if (nextPath && nextPath !== LOGIN_PATH) {
    url.searchParams.set('next', nextPath);
  }
  if (reason) {
    url.searchParams.set('reason', reason);
  }

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

const readFallbackRole = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

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

const isOwnerDriverWorkspaceRequested = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined
) => {
  const tags = [
    readMetadataRole(userMetadata, 'account_type'),
    readMetadataRole(userMetadata, 'workspace_mode'),
    readMetadataRole(userMetadata, 'requested_role'),
    readMetadataRole(userMetadata, 'role'),
    readMetadataRole(appMetadata, 'account_type'),
    readMetadataRole(appMetadata, 'workspace_mode'),
    readMetadataRole(appMetadata, 'requested_role'),
    readMetadataRole(appMetadata, 'role'),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().trim());

  return (
    readMetadataFlag(userMetadata, 'owner_driver_workspace') ||
    readMetadataFlag(appMetadata, 'owner_driver_workspace') ||
    tags.some((value) => value === 'owner_driver' || value === 'owner-driver' || value === 'sole_trader')
  );
};

const isOwnerDriverExecutionModeRequested = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined
) => {
  const tags = [
    readMetadataRole(userMetadata, 'workspace_mode'),
    readMetadataRole(userMetadata, 'execution_mode'),
    readMetadataRole(appMetadata, 'workspace_mode'),
    readMetadataRole(appMetadata, 'execution_mode'),
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

const isNetlifyPreviewHost = (host: string) =>
  host.endsWith('.netlify.app') && (
    host.startsWith('deploy-preview-') ||
    host.startsWith('branch-') ||
    host.includes('--')
  );

const isProtectedPath = (pathname: string) =>
  PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const buildCanonicalHostRedirect = (request: NextRequest) => {
  if (!shouldEnforceCanonicalHost()) return null;

  const incomingHost = request.headers.get('host')?.toLowerCase();
  if (!incomingHost || incomingHost === canonicalHost) return null;
  if (isNetlifyPreviewHost(incomingHost)) return null;

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.protocol = canonicalSiteUrl.protocol;
  redirectUrl.host = canonicalHost;
  redirectUrl.port = '';
  return NextResponse.redirect(redirectUrl, 308);
};

const resolveRouteAuth = async (request: NextRequest): Promise<RouteAuthResult> => {
  const accessToken = request.cookies.get(ROUTE_AUTH_COOKIE_NAME)?.value?.trim();
  if (!accessToken || !supabaseValidator) {
    return { kind: 'unauthenticated' };
  }

  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(accessToken);
  if (authError && isServiceFailure(authError.message)) {
    return { kind: 'service_unavailable' };
  }
  if (authError || !authData.user) {
    return { kind: 'unauthenticated' };
  }

  const fallbackRole = readFallbackRole(authData.user.app_metadata?.role);
  const ownerDriverWorkspace = isOwnerDriverWorkspaceRequested(
    authData.user.user_metadata as Record<string, unknown> | null | undefined,
    authData.user.app_metadata as Record<string, unknown> | null | undefined
  );
  const ownerDriverExecutionMode = isOwnerDriverExecutionModeRequested(
    authData.user.user_metadata as Record<string, unknown> | null | undefined,
    authData.user.app_metadata as Record<string, unknown> | null | undefined
  );

  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    const role = mapAppRole(fallbackRole);
    return role
      ? {
          kind: 'authenticated',
          role,
          mustChangePassword: false,
          appAccess: null,
          ownerDriverWorkspace,
          ownerDriverExecutionMode,
          canAccessDriverMode: ownerDriverWorkspace && role === 'driver',
        }
      : { kind: 'forbidden' };
  }

  const [profileRes, membershipRes, driverRes, creatorCompanyRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('role, status, is_driver')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('role_in_company')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('drivers')
      .select('app_access, must_change_password')
      .eq('user_id', authData.user.id)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('companies')
      .select('company_type')
      .eq('created_by', authData.user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.error
    ? null
    : (profileRes.data as { role?: string | null; status?: string | null; is_driver?: boolean | null } | null);
  const membership = membershipRes.error
    ? null
    : (membershipRes.data as { role_in_company?: string | null } | null);
  const driver = driverRes.error
    ? null
    : (driverRes.data as { app_access?: boolean | null; must_change_password?: boolean | null } | null);
  const creatorCompany = creatorCompanyRes.error
    ? null
    : (creatorCompanyRes.data as { company_type?: string | null } | null);

  if (
    isServiceFailure(profileRes.error?.message) ||
    isServiceFailure(membershipRes.error?.message) ||
    isServiceFailure(driverRes.error?.message) ||
    isServiceFailure(creatorCompanyRes.error?.message)
  ) {
    return { kind: 'service_unavailable' };
  }

  const profileStatus = profile?.status?.toLowerCase();
  if (profileStatus === 'pending' || profileStatus === 'blocked' || profileStatus === 'suspended' || profileStatus === 'inactive') {
    return { kind: 'forbidden' };
  }

  const role = resolveAuthoritativeRole({
    membershipRole: membership?.role_in_company ?? null,
    profileRole: profile?.role ?? null,
    isDriver: driver != null || profile?.is_driver === true,
    hasCreatedCompany: creatorCompany != null,
    creatorCompanyType: creatorCompany?.company_type ?? null,
    fallbackRole,
    ownerDriverWorkspaceRequested: ownerDriverWorkspace,
  });

  if (!role) {
    return { kind: 'forbidden' };
  }

  const canAccessDriverMode =
    ownerDriverWorkspace &&
    (
      driver != null ||
      profile?.is_driver === true ||
      mapAppRole(profile?.role ?? null) === 'driver' ||
      mapAppRole(fallbackRole) === 'driver'
    );

  return {
    kind: 'authenticated',
    role,
    mustChangePassword: (role === 'driver' || canAccessDriverMode) && driver?.must_change_password === true,
    appAccess: (role === 'driver' || canAccessDriverMode) ? (driver?.app_access ?? null) : null,
    ownerDriverWorkspace,
    ownerDriverExecutionMode,
    canAccessDriverMode,
  };
};

export async function middleware(request: NextRequest) {
  const canonicalRedirect = buildCanonicalHostRedirect(request);
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const auth = await resolveRouteAuth(request);
  if (auth.kind === 'unauthenticated') {
    return buildLoginRedirect(request);
  }

  if (auth.kind === 'service_unavailable') {
    return buildLoginRedirect(request, 'service_unavailable');
  }

  if (auth.kind === 'forbidden') {
    return buildRedirect(request, FORBIDDEN_PATH);
  }

  const url = request.nextUrl.clone();

  const hasMockDashboardParam =
    url.pathname === DRIVER_JOBS_PATH &&
    (url.searchParams.get('mock-dashboard') === '1' || url.searchParams.has('mock-dashboard'));

  const driverRouteRequested = url.pathname === DRIVER_PATH || url.pathname.startsWith('/driver/');
  const driverModeActive = auth.role === 'driver' || (auth.canAccessDriverMode && driverRouteRequested);

  if (driverModeActive) {
    if (auth.appAccess === false) {
      return buildRedirect(request, FORBIDDEN_PATH);
    }

    if (auth.mustChangePassword && url.pathname !== DRIVER_CHANGE_PASSWORD_PATH) {
      return buildRedirect(request, DRIVER_CHANGE_PASSWORD_PATH);
    }
  }

  if (url.pathname === DRIVER_PATH) {
    if (auth.canAccessDriverMode) {
      return buildRedirect(
        request,
        getPostLoginRoute({
          role: auth.role,
          mustChangePassword: auth.mustChangePassword,
          ownerDriverWorkspace: auth.ownerDriverWorkspace,
          canAccessDriverMode: true,
          ownerDriverExecutionMode: true,
        })
      );
    }
    return buildRedirect(
      request,
      getPostLoginRoute({
        role: auth.role,
        mustChangePassword: auth.mustChangePassword,
        ownerDriverWorkspace: auth.ownerDriverWorkspace,
        canAccessDriverMode: auth.canAccessDriverMode,
        ownerDriverExecutionMode: auth.ownerDriverExecutionMode,
      })
    );
  }

  if (!isRoleAllowedForPath(url.pathname, auth.role, { canAccessDriverMode: auth.canAccessDriverMode })) {
    const canonicalPath = getPostLoginRoute({
      role: auth.role,
      mustChangePassword: auth.mustChangePassword,
      ownerDriverWorkspace: auth.ownerDriverWorkspace,
      canAccessDriverMode: auth.canAccessDriverMode,
      ownerDriverExecutionMode: auth.ownerDriverExecutionMode,
    });
    return canonicalPath !== url.pathname
      ? buildRedirect(request, canonicalPath)
      : buildRedirect(request, FORBIDDEN_PATH);
  }

  if (hasMockDashboardParam) {
    return buildRedirect(request, DRIVER_JOBS_PATH);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};
