import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from './app/api/_lib/supabaseAdmin';
import { resolveAccountTypeFromMetadata } from './lib/accountTypes';
import {
  classifyAccessLifecycleStatus,
  classifyOnboardingLifecycleStatus,
} from './lib/accessLifecycle';
import { getPostLoginRoute } from './lib/authSession';
import {
  isRoleAllowedForPath,
  mapAppRole,
  resolveAuthoritativeRole,
  roleRequiresCompanyContext,
  type AppUserRole,
} from './lib/authRole';
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
  | { kind: 'redirect'; pathname: string }
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

const readMetadataText = (
  metadata: Record<string, unknown> | null | undefined,
  key: string
): string | null => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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

const isServiceFailure = (message: string | null | undefined) => {
  const normalized = (message ?? '').toLowerCase();
  return ['failed to fetch', 'network', 'timeout', 'timed out', 'fetch', '503'].some((value) =>
    normalized.includes(value)
  );
};

const canonicalSiteUrl = getCanonicalSiteUrl();
const canonicalHost = canonicalSiteUrl.host.toLowerCase();
const shouldEnforceCanonicalHost = () =>
  process.env.NODE_ENV === 'production' || process.env.XDRIVE_FORCE_CANONICAL_HOST === 'true';
const normalizeHost = (host: string) => host.replace(/:\d+$/, '').replace(/^\[(.*)\]$/, '$1').toLowerCase();
const isLocalTestHost = (host: string) => ['localhost', '127.0.0.1', '::1'].includes(normalizeHost(host));
const isNetlifyPreviewHost = (host: string) =>
  host.endsWith('.netlify.app') && (
    host.startsWith('deploy-preview-') || host.startsWith('branch-') || host.includes('--')
  );
const isProtectedPath = (pathname: string) =>
  PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const buildCanonicalHostRedirect = (request: NextRequest) => {
  if (!shouldEnforceCanonicalHost()) return null;
  const incomingHost = request.headers.get('host')?.toLowerCase();
  if (!incomingHost || incomingHost === canonicalHost) return null;
  if (isLocalTestHost(incomingHost) || isNetlifyPreviewHost(incomingHost)) return null;

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

  // Protected route authorisation must never fall back to unverified metadata.
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { kind: 'service_unavailable' };

  const userMetadata = authData.user.user_metadata as Record<string, unknown> | null | undefined;
  const appMetadata = authData.user.app_metadata as Record<string, unknown> | null | undefined;
  const accountType = resolveAccountTypeFromMetadata(userMetadata, appMetadata);
  const fallbackRole = accountType
    ?? readMetadataText(appMetadata, 'role')
    ?? readMetadataText(userMetadata, 'role')
    ?? readMetadataText(userMetadata, 'requested_role');
  const ownerDriverWorkspaceFromMetadata = accountType === 'owner_driver'
    || readMetadataFlag(userMetadata, 'owner_driver_workspace')
    || readMetadataFlag(appMetadata, 'owner_driver_workspace');
  const ownerDriverExecutionMode = readMetadataFlag(userMetadata, 'owner_driver_execution_mode')
    || readMetadataFlag(appMetadata, 'owner_driver_execution_mode');

  const [profileResult, onboardingResult, membershipResult, driverResult, creatorCompanyResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('role, status, is_driver, company_id')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('onboarding_applications')
      .select('status, account_type, company_id')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('company_id, role_in_company, status')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('drivers')
      .select('company_id, app_access, must_change_password')
      .eq('user_id', authData.user.id)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('companies')
      .select('id, company_type, status')
      .eq('created_by', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const errors = [
    profileResult.error,
    onboardingResult.error,
    membershipResult.error,
    driverResult.error,
    creatorCompanyResult.error,
  ].filter(Boolean);
  if (errors.some((error) => isServiceFailure(error?.message))) return { kind: 'service_unavailable' };
  if (errors.length > 0) return { kind: 'forbidden' };

  const onboarding = onboardingResult.data as {
    status?: string | null;
    account_type?: string | null;
    company_id?: string | null;
  } | null;
  if (onboarding) {
    const lifecycle = classifyOnboardingLifecycleStatus(onboarding.status);
    if (lifecycle === 'editable') return { kind: 'redirect', pathname: '/onboarding/resume' };
    if (lifecycle === 'review') return { kind: 'redirect', pathname: '/pending-approval' };
    if (lifecycle === 'rejected' || lifecycle === 'unknown') return { kind: 'forbidden' };
  }

  const profile = profileResult.data as {
    role?: string | null;
    status?: string | null;
    is_driver?: boolean | null;
    company_id?: string | null;
  } | null;
  if (!profile) return { kind: 'forbidden' };

  const profileLifecycle = classifyAccessLifecycleStatus(profile.status);
  if (profileLifecycle === 'pending') return { kind: 'redirect', pathname: '/pending-approval' };
  if (profileLifecycle !== 'active') return { kind: 'forbidden' };

  const membership = membershipResult.data as {
    company_id?: string | null;
    role_in_company?: string | null;
    status?: string | null;
  } | null;
  const driver = driverResult.data as {
    company_id?: string | null;
    app_access?: boolean | null;
    must_change_password?: boolean | null;
  } | null;
  const creatorCompany = creatorCompanyResult.data as {
    id?: string | null;
    company_type?: string | null;
    status?: string | null;
  } | null;
  const normalizedCreatorCompanyType = (creatorCompany?.company_type ?? '').toLowerCase().trim();
  const ownerDriverWorkspace = ownerDriverWorkspaceFromMetadata
    || ['owner_driver', 'owner_operator'].includes(normalizedCreatorCompanyType)
    || (
      mapAppRole(profile.role ?? null) === 'driver'
      && membership?.role_in_company === 'owner'
      && driver != null
    );

  const role = resolveAuthoritativeRole({
    membershipRole: membership?.role_in_company ?? null,
    profileRole: profile.role ?? null,
    isDriver: driver != null || profile.is_driver === true,
    hasCreatedCompany: Boolean(creatorCompany?.id),
    creatorCompanyType: creatorCompany?.company_type ?? null,
    fallbackRole,
    ownerDriverWorkspaceRequested: ownerDriverWorkspace,
  });
  if (!role) return { kind: 'forbidden' };

  const companyId = membership?.company_id
    ?? profile.company_id
    ?? driver?.company_id
    ?? creatorCompany?.id
    ?? onboarding?.company_id
    ?? null;
  const requiresActiveCompany = roleRequiresCompanyContext(role)
    || role === 'customer'
    || ownerDriverWorkspace;

  if (requiresActiveCompany) {
    if (!companyId || !membership?.company_id) return { kind: 'forbidden' };

    let companyStatus = creatorCompany?.id === companyId ? creatorCompany.status : null;
    if (creatorCompany?.id !== companyId) {
      const { data: company, error: companyError } = await supabaseAdmin
        .from('companies')
        .select('status')
        .eq('id', companyId)
        .maybeSingle();
      if (companyError && isServiceFailure(companyError.message)) return { kind: 'service_unavailable' };
      if (companyError) return { kind: 'forbidden' };
      companyStatus = company?.status ?? null;
    }

    const companyLifecycle = classifyAccessLifecycleStatus(companyStatus);
    if (companyLifecycle === 'pending') return { kind: 'redirect', pathname: '/pending-approval' };
    if (companyLifecycle !== 'active') return { kind: 'forbidden' };
  }

  if (ownerDriverWorkspace && driver?.app_access !== true) {
    return { kind: 'redirect', pathname: '/pending-approval' };
  }

  const canAccessDriverMode = ownerDriverWorkspace && (
    driver != null
    || profile.is_driver === true
    || mapAppRole(profile.role ?? null) === 'driver'
    || mapAppRole(fallbackRole) === 'driver'
  );
  const rawRole = accountType
    ?? (ownerDriverWorkspace ? 'owner_driver' : null)
    ?? (role === 'broker' ? 'broker' : null)
    ?? fallbackRole
    ?? profile.role
    ?? null;
  const resolvedWorkspaceRole = resolveWorkspaceRole({
    role,
    rawRole,
    membershipRole: membership?.role_in_company ?? null,
    ownerDriverWorkspace,
  });
  const workspaceRole: WorkspaceRole = accountType === 'fleet_operator'
    ? 'company_owner'
    : ownerDriverWorkspace
      ? 'owner_driver'
      : resolvedWorkspaceRole;

  return {
    kind: 'authenticated',
    role,
    rawRole,
    workspaceRole,
    mustChangePassword: role === 'driver' && driver?.must_change_password === true,
    appAccess: role === 'driver' ? (driver?.app_access ?? null) : null,
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
  if (auth.kind === 'redirect') return buildRedirect(request, auth.pathname);

  const url = request.nextUrl.clone();
  const hasMockDashboardParam =
    url.pathname === DRIVER_JOBS_PATH
    && (url.searchParams.get('mock-dashboard') === '1' || url.searchParams.has('mock-dashboard'));
  const driverRouteRequested = url.pathname === DRIVER_PATH || url.pathname.startsWith('/driver/');
  const driverModeActive = auth.role === 'driver' || (auth.canAccessDriverMode && driverRouteRequested);

  if (driverModeActive) {
    if (auth.appAccess === false) return buildRedirect(request, '/pending-approval');
    if (auth.mustChangePassword && url.pathname !== DRIVER_CHANGE_PASSWORD_PATH) {
      return buildRedirect(request, DRIVER_CHANGE_PASSWORD_PATH);
    }
  }

  if (url.pathname === '/admin' && (auth.workspaceRole === 'driver' || auth.workspaceRole === 'owner_driver')) {
    return buildRedirect(request, '/driver');
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
