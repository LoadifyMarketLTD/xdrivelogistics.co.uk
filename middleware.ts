import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from './app/api/_lib/supabaseAdmin';
import { getPostLoginRoute } from './lib/authSession';
import { resolveActiveCompanyContext, type RawMembershipRow } from './lib/activeWorkspace';
import { isRoleAllowedForPath, mapAppRole, resolveAuthoritativeRole, type AppUserRole } from './lib/authRole';
import { isDriverExecutionModeRequested, isDriverProviderWorkspaceRequested } from './lib/driverWorkspaceMode';
import { resolveMembershipRole, type MembershipRole } from './lib/membershipRole';
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
      membershipId: string | null;
      membershipRole: MembershipRole | null;
      driverId: string | null;
      canCommercialBid: boolean | null;
      driverStatus: string | null;
      accountStatus: string | null;
      companyStatus: string | null;
    };

type MembershipQueryRow = {
  id?: string | null;
  company_id?: string | null;
  user_id?: string | null;
  role_in_company?: string | null;
  status?: string | null;
  companies?:
    | {
        id?: string | null;
        name?: string | null;
        company_type?: string | null;
        status?: string | null;
      }
    | Array<{
        id?: string | null;
        name?: string | null;
        company_type?: string | null;
        status?: string | null;
      }>
    | null;
};

type DriverRouteRow = {
  id?: string | null;
  company_id?: string | null;
  app_access?: boolean | null;
  must_change_password?: boolean | null;
  status?: string | null;
  can_commercial_bid?: boolean | null;
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

const normalizeMembershipRows = (rows: MembershipQueryRow[]): RawMembershipRow[] => {
  const normalized: RawMembershipRow[] = [];

  for (const row of rows) {
    const companiesValue = Array.isArray(row.companies)
      ? row.companies[0] ?? null
      : row.companies ?? null;

    const membershipId = row.id ?? null;
    const companyId = row.company_id ?? null;
    const userId = row.user_id ?? null;
    const companyName = companiesValue?.name ?? null;

    if (!membershipId || !companyId || !userId || !companiesValue?.id || !companyName) {
      continue;
    }

    normalized.push({
      id: membershipId,
      company_id: companyId,
      user_id: userId,
      role_in_company: row.role_in_company ?? null,
      status: row.status ?? null,
      companies: {
        id: companiesValue.id,
        name: companyName,
        company_type: companiesValue.company_type ?? null,
        status: companiesValue.status ?? null,
      },
    });
  }

  return normalized;
};

const readFallbackRole = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const isMissingDriverCanBidColumn = (
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
): boolean => {
  if (!error || error.code !== '42703') return false;
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return text.includes('can_commercial_bid');
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

const isLocalTestHost = (host: string) => {
  const normalized = normalizeHost(host);
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
};

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
  if (isLocalTestHost(incomingHost)) return null;
  if (isNetlifyPreviewHost(incomingHost)) return null;

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.protocol = canonicalSiteUrl.protocol;
  redirectUrl.host = canonicalHost;
  redirectUrl.port = '';
  return NextResponse.redirect(redirectUrl, 308);
};

export const resolveRouteAuth = async (request: NextRequest): Promise<RouteAuthResult> => {
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
  const ownerDriverWorkspaceRequested = isDriverProviderWorkspaceRequested(
    null,
    authData.user.app_metadata as Record<string, unknown> | null | undefined
  );
  const ownerDriverExecutionModeRequested = isDriverExecutionModeRequested(
    null,
    authData.user.app_metadata as Record<string, unknown> | null | undefined
  );

  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { kind: 'service_unavailable' };
  }

  const superAdminRouteRequested =
    request.nextUrl.pathname === '/super-admin' || request.nextUrl.pathname.startsWith('/super-admin/');

  // Super Admin access depends only on the authoritative server-side profile.
  // Resolve that boundary before company context so every Super Admin navigation
  // avoids unnecessary company_memberships and companies queries.
  if (superAdminRouteRequested) {
    const { data: superAdminProfileData, error: superAdminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, status')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (isServiceFailure(superAdminProfileError?.message) || superAdminProfileError) {
      return { kind: 'service_unavailable' };
    }

    const superAdminProfile = superAdminProfileData as {
      role?: string | null;
      status?: string | null;
    } | null;

    if (!superAdminProfile || superAdminProfile.status?.toLowerCase() !== 'active') {
      return { kind: 'forbidden' };
    }

    const superAdminRole = mapAppRole(superAdminProfile.role ?? null);
    if (superAdminRole !== 'owner') {
      return { kind: 'forbidden' };
    }

    return {
      kind: 'authenticated',
      role: 'owner',
      rawRole: superAdminProfile.role ?? null,
      workspaceRole: 'platform_owner',
      mustChangePassword: false,
      appAccess: null,
      ownerDriverWorkspace: false,
      ownerDriverExecutionMode: false,
      canAccessDriverMode: false,
      membershipId: null,
      membershipRole: null,
      driverId: null,
      canCommercialBid: null,
      driverStatus: null,
      accountStatus: 'active',
      companyStatus: null,
    };
  }

  const [profileRes, membershipsRes, creatorCompanyRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('role, status, is_driver, company_id')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('id, company_id, user_id, role_in_company, status, companies(id, name, company_type, status)')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('companies')
      .select('id, company_type')
      .eq('created_by', authData.user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    isServiceFailure(profileRes.error?.message) ||
    isServiceFailure(membershipsRes.error?.message) ||
    isServiceFailure(creatorCompanyRes.error?.message)
  ) {
    return { kind: 'service_unavailable' };
  }

  if (profileRes.error || membershipsRes.error || creatorCompanyRes.error) {
    // A DB query error is not an access-control decision — it means the
    // underlying data could not be read (transient connection hiccup, schema
    // drift, or an RLS policy issue that isn't a network failure).  Returning
    // 'forbidden' here was silently turning these transient failures into a
    // permanent-looking 403 page.  Return 'service_unavailable' so the user
    // is sent to the login page with a retryable "service unavailable" message
    // rather than being told they have no permission.
    return { kind: 'service_unavailable' };
  }

  const profile = profileRes.data as {
    role?: string | null;
    status?: string | null;
    is_driver?: boolean | null;
    company_id?: string | null;
  } | null;
  const memberships = normalizeMembershipRows((membershipsRes.data ?? []) as MembershipQueryRow[]);
  const creatorCompany = creatorCompanyRes.data as { id?: string | null; company_type?: string | null } | null;

  if (!profile) {
    return { kind: 'forbidden' };
  }

  const profileStatus = profile.status?.toLowerCase() ?? null;
  if (profileStatus !== 'active') {
    return { kind: 'forbidden' };
  }

  // Customer/Shipper and Driver are valid standalone portal identities in the
  // existing XDrive auth/RLS contracts. Resolve only those roles before the
  // company-membership gate; all broker/admin/carrier identities continue to
  // require an authoritative active company context.
  if (memberships.length === 0) {
    const rawRole = profile.role ?? fallbackRole ?? null;
    const standaloneRole = resolveAuthoritativeRole({
      membershipRole: null,
      profileRole: profile.role ?? null,
      isDriver: profile.is_driver === true,
      hasCreatedCompany: Boolean(creatorCompany?.id),
      creatorCompanyType: creatorCompany?.company_type ?? null,
      fallbackRole,
      ownerDriverWorkspaceRequested: false,
    });

    if (standaloneRole === 'customer') {
      return {
        kind: 'authenticated',
        role: 'customer',
        rawRole,
        workspaceRole: resolveWorkspaceRole({
          role: 'customer',
          rawRole,
          membershipRole: null,
          ownerDriverWorkspace: false,
        }),
        mustChangePassword: false,
        appAccess: null,
        ownerDriverWorkspace: false,
        ownerDriverExecutionMode: false,
        canAccessDriverMode: false,
        membershipId: null,
        membershipRole: null,
        driverId: null,
        canCommercialBid: null,
        driverStatus: null,
        accountStatus: profileStatus,
        companyStatus: null,
      };
    }

    const standaloneDriverIdentity =
      standaloneRole === 'driver' ||
      profile.is_driver === true ||
      mapAppRole(profile.role ?? null) === 'driver' ||
      mapAppRole(fallbackRole) === 'driver';

    if (standaloneDriverIdentity) {
      const { data: standaloneDriverInitial, error: standaloneDriverErrorInitial } = await supabaseAdmin
        .from('drivers')
        .select('id, company_id, app_access, must_change_password, status, can_commercial_bid')
        .eq('user_id', authData.user.id)
        .eq('status', 'active')
        .limit(2);

      const standaloneDriverNeedsLegacyFallback = isMissingDriverCanBidColumn(standaloneDriverErrorInitial);
      const { data: standaloneDriverData, error: standaloneDriverError } = standaloneDriverNeedsLegacyFallback
        ? await supabaseAdmin
            .from('drivers')
            .select('id, company_id, app_access, must_change_password, status')
            .eq('user_id', authData.user.id)
            .eq('status', 'active')
            .limit(2)
        : { data: standaloneDriverInitial, error: standaloneDriverErrorInitial };

      if (isServiceFailure(standaloneDriverError?.message)) {
        return { kind: 'service_unavailable' };
      }
      if (standaloneDriverError) {
        return { kind: 'service_unavailable' };
      }

      const standaloneDrivers = (standaloneDriverData ?? []) as DriverRouteRow[];
      // No driver evidence, or more than one active driver context, stays
      // fail-closed because there is no membership to disambiguate company scope.
      if (standaloneDrivers.length !== 1) {
        return { kind: 'forbidden' };
      }

      const driver = standaloneDrivers[0];
      if (!driver?.id || driver.status?.toLowerCase() !== 'active' || driver.app_access !== true) {
        return { kind: 'forbidden' };
      }

      const ownerDriverWorkspace = ownerDriverWorkspaceRequested;
      const ownerDriverExecutionMode = ownerDriverWorkspace && ownerDriverExecutionModeRequested;

      return {
        kind: 'authenticated',
        role: 'driver',
        rawRole,
        workspaceRole: resolveWorkspaceRole({
          role: 'driver',
          rawRole,
          membershipRole: null,
          ownerDriverWorkspace,
        }),
        mustChangePassword: driver.must_change_password === true,
        appAccess: true,
        ownerDriverWorkspace,
        ownerDriverExecutionMode,
        canAccessDriverMode: true,
        membershipId: null,
        membershipRole: null,
        driverId: driver.id,
        canCommercialBid: standaloneDriverNeedsLegacyFallback ? null : (driver.can_commercial_bid ?? null),
        driverStatus: driver.status ?? null,
        accountStatus: profileStatus,
        companyStatus: null,
      };
    }

    return { kind: 'forbidden' };
  }

  const activeCompany = resolveActiveCompanyContext(memberships, {
    preferredCompanyId: profile.company_id ?? null,
    targetPathname: request.nextUrl.pathname,
  });
  if (!activeCompany.ok) {
    return { kind: 'forbidden' };
  }

  const selectedMembership = memberships.find((membership) => membership.id === activeCompany.context.membershipId);
  if (!selectedMembership?.companies) {
    return { kind: 'forbidden' };
  }

  const { data: driverDataInitial, error: driverErrorInitial } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, app_access, must_change_password, status, can_commercial_bid')
    .eq('user_id', authData.user.id)
    .eq('company_id', activeCompany.context.companyId)
    .limit(1)
    .maybeSingle();

  // PostgreSQL 42703 compatibility: when the live schema is missing can_commercial_bid
  // (production schema drift — unapplied migration 20260725184000), retry exactly once
  // with the legacy column set.  Commercial bidding is fail-closed: null if unavailable.
  const driverNeedsLegacyFallback = isMissingDriverCanBidColumn(driverErrorInitial);
  const { data: driverData, error: driverError } = driverNeedsLegacyFallback
    ? await supabaseAdmin
        .from('drivers')
        .select('id, company_id, app_access, must_change_password, status')
        .eq('user_id', authData.user.id)
        .eq('company_id', activeCompany.context.companyId)
        .limit(1)
        .maybeSingle()
    : { data: driverDataInitial, error: driverErrorInitial };

  if (isServiceFailure(driverError?.message)) {
    return { kind: 'service_unavailable' };
  }
  if (driverError) {
    // Same principle as the profile/membership query block above: an unexpected
    // DB error reading driver data is a service issue, not an access denial.
    return { kind: 'service_unavailable' };
  }

  const driver = driverData as DriverRouteRow | null;

  if (driver && driver.company_id !== activeCompany.context.companyId) {
    return { kind: 'forbidden' };
  }

  const membershipRole = resolveMembershipRole(selectedMembership.role_in_company ?? null);
  if (selectedMembership.role_in_company && !membershipRole) {
    return { kind: 'forbidden' };
  }
  const companyStatus = selectedMembership.companies.status?.toLowerCase() ?? null;
  if (companyStatus !== 'active') {
    return { kind: 'forbidden' };
  }
  const ownerDriverWorkspace =
    ownerDriverWorkspaceRequested && Boolean(driver?.id);
  const ownerDriverExecutionMode = ownerDriverWorkspace && ownerDriverExecutionModeRequested;

  const role = resolveAuthoritativeRole({
    membershipRole,
    profileRole: profile.role ?? null,
    isDriver: driver != null || profile.is_driver === true,
    hasCreatedCompany: Boolean(creatorCompany?.id && creatorCompany.id === activeCompany.context.companyId),
    creatorCompanyType: creatorCompany?.company_type ?? null,
    fallbackRole,
    ownerDriverWorkspaceRequested: ownerDriverWorkspace,
  });

  if (!role) {
    return { kind: 'forbidden' };
  }

  const canAccessDriverMode =
    Boolean(driver?.id) &&
    driver?.status?.toLowerCase() === 'active' &&
    driver?.app_access === true;

  const rawRole = profile.role ?? fallbackRole ?? null;
  const workspaceRole =
    activeCompany.context.activeWorkspace === 'broker' && role === 'owner'
      ? 'broker'
      : resolveWorkspaceRole({
          role,
          rawRole,
          membershipRole,
          ownerDriverWorkspace,
        });

  return {
    kind: 'authenticated',
    role,
    rawRole,
    workspaceRole,
    mustChangePassword: (role === 'driver' || canAccessDriverMode) && driver?.must_change_password === true,
    appAccess: driver?.app_access ?? null,
    ownerDriverWorkspace,
    ownerDriverExecutionMode,
    canAccessDriverMode,
    membershipId: activeCompany.context.membershipId,
    membershipRole,
    driverId: driver?.id ?? null,
    canCommercialBid: driverNeedsLegacyFallback ? null : (driver?.can_commercial_bid ?? null),
    driverStatus: driver?.status ?? null,
    accountStatus: profileStatus,
    companyStatus,
  };
};

function generateNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf));
}

function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval' https://*.supabase.co https://*.netlify.app`
    : `'self' 'nonce-${nonce}' https://*.supabase.co https://*.netlify.app`;
  const styleSrc = isDev ? `'self' 'unsafe-inline'` : `'self'`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ');
}

function buildNonceResponse(request: NextRequest, nonce: string) {
  const csp = buildCspHeader(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export async function middleware(request: NextRequest) {
  const canonicalRedirect = buildCanonicalHostRedirect(request);
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  const nonce = generateNonce();

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return buildNonceResponse(request, nonce);
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
  const driverModeActive = driverRouteRequested;

  if (driverModeActive) {
    if (!auth.driverId || auth.driverStatus?.toLowerCase() !== 'active') {
      return buildRedirect(request, FORBIDDEN_PATH);
    }

    if (auth.appAccess !== true) {
      return buildRedirect(request, FORBIDDEN_PATH);
    }

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

  const companyStatusForAccess =
    auth.role === 'driver' && auth.membershipId === null && auth.companyStatus === null
      ? 'active'
      : auth.companyStatus;

  if (!isRoleAllowedForPath(url.pathname, auth.role, {
    canAccessDriverMode: auth.canAccessDriverMode,
    membershipId: auth.membershipId,
    membershipRole: auth.membershipRole,
    ownerDriverWorkspace: auth.ownerDriverWorkspace,
    ownerDriverExecutionMode: auth.ownerDriverExecutionMode,
    rawRole: auth.rawRole,
    workspaceRole: auth.workspaceRole,
    driverId: auth.driverId,
    canCommercialBid: auth.canCommercialBid,
    driverStatus: auth.driverStatus,
    appAccess: auth.appAccess,
    accountStatus: auth.accountStatus,
    companyStatus: companyStatusForAccess,
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

  if (hasMockDashboardParam) {
    return buildRedirect(request, DRIVER_JOBS_PATH);
  }

  return buildNonceResponse(request, nonce);
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};