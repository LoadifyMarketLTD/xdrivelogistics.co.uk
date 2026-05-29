import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAuthoritativeRole, roleRequiresCompanyContext, shouldAutoProvisionCompany } from './lib/authRole';

type UserRole = 'customer' | 'driver' | 'company' | 'admin' | 'owner';

const PROTECTED_PREFIXES = ['/admin', '/m', '/driver', '/customer'] as const;
const ADMIN_ROLES = new Set<UserRole>(['company', 'admin', 'owner']);
const MOBILE_ROLES = new Set<UserRole>(['company', 'admin', 'owner']);
const DRIVER_ROLES = new Set<UserRole>(['driver']);
const CUSTOMER_ROLES = new Set<UserRole>(['customer']);
const SUPABASE_AUTH_TIMEOUT_MS = 5_000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

const hasSupabaseAuthCookie = (request: NextRequest) => {
  return request.cookies.getAll().some(
    (cookie) => cookie.name.includes('sb-') && cookie.name.includes('-auth-token')
  );
};

const decodeUrlSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseAuthCookieToken = (value: string): string | null => {
  const decodedValue = decodeUrlSafe(value);
  const candidates = [decodedValue, value];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && typeof (parsed as { access_token?: unknown }).access_token === 'string') {
        return (parsed as { access_token: string }).access_token;
      }
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
        return parsed[0];
      }
    } catch {
      continue;
    }
  }

  if (decodedValue.split('.').length === 3) return decodedValue;
  if (value.split('.').length === 3) return value;
  return null;
};

const extractAccessToken = (request: NextRequest): string | null => {
  const tokenCookies = request.cookies
    .getAll()
    .filter((cookie) => cookie.name.includes('sb-') && cookie.name.includes('-auth-token'));

  if (!tokenCookies.length) return null;

  const grouped = new Map<string, Array<{ index: number; value: string }>>();
  for (const cookie of tokenCookies) {
    const match = cookie.name.match(/^(.*)\.(\d+)$/);
    const baseName = match ? match[1] : cookie.name;
    const chunkIndex = match ? Number(match[2]) : 0;
    const existing = grouped.get(baseName) ?? [];
    existing.push({ index: chunkIndex, value: cookie.value });
    grouped.set(baseName, existing);
  }

  for (const chunks of grouped.values()) {
    chunks.sort((a, b) => a.index - b.index);
    const joinedValue = chunks.map((chunk) => chunk.value).join('');
    const token = parseAuthCookieToken(joinedValue);
    if (token) return token;
  }

  return null;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const isJwtExpired = (payload: Record<string, unknown> | null): boolean => {
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;
  if (!exp) return false;
  return Date.now() >= exp * 1000;
};

const fetchRoleSnapshot = async (
  token: string,
  userId: string,
  fallbackRole: string | null
): Promise<{ status: 'ok' | 'unauthenticated' | 'error'; role: UserRole | null; companyId: string | null; mustChangePassword: boolean }> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 'error', role: null, companyId: null, mustChangePassword: false };
  }

  const fetchRows = async (endpoint: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPABASE_AUTH_TIMEOUT_MS);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        return { type: 'unauthenticated' as const, rows: null };
      }
      if (!response.ok) {
        return { type: 'error' as const, rows: null };
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        return { type: 'error' as const, rows: null };
      }

      return { type: 'ok' as const, rows: data as Array<Record<string, unknown>> };
    } catch {
      return { type: 'error' as const, rows: null };
    } finally {
      clearTimeout(timeout);
    }
  };

  const callRpc = async (functionName: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPABASE_AUTH_TIMEOUT_MS);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({}),
        cache: 'no-store',
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        return { type: 'unauthenticated' as const, value: null };
      }
      if (!response.ok) {
        return { type: 'error' as const, value: null };
      }

      const data = await response.json();
      return { type: 'ok' as const, value: typeof data === 'string' ? data : null };
    } catch {
      return { type: 'error' as const, value: null };
    } finally {
      clearTimeout(timeout);
    }
  };

  const [profileRes, membershipRes, driverRes, creatorCompanyRes] = await Promise.all([
    fetchRows(`profiles?select=role,is_driver,company_id&user_id=eq.${userId}&limit=1`),
    fetchRows(`company_memberships?select=company_id,role_in_company,status&user_id=eq.${userId}&status=neq.suspended&order=updated_at.desc&limit=1`),
    fetchRows(`drivers?select=id,company_id,user_id,app_access,must_change_password&user_id=eq.${userId}&app_access=eq.true&limit=1`),
    fetchRows(`companies?select=id,company_type&created_by=eq.${userId}&limit=1`),
  ]);

  const queryResults = [profileRes, membershipRes, driverRes, creatorCompanyRes];
  const profileLookupFailed = profileRes.type !== 'ok';

  // If every lookup is unauthenticated the token is invalid — redirect to login.
  if (queryResults.every((result) => result.type === 'unauthenticated')) {
    return { status: 'unauthenticated', role: null, companyId: null, mustChangePassword: false };
  }

  const profile = profileRes.type === 'ok' ? (profileRes.rows?.[0] ?? null) : null;
  const membership = membershipRes.type === 'ok' ? (membershipRes.rows?.[0] ?? null) : null;
  const driver = driverRes.type === 'ok' ? (driverRes.rows?.[0] ?? null) : null;
  const creatorCompany = creatorCompanyRes.type === 'ok' ? (creatorCompanyRes.rows?.[0] ?? null) : null;
  const mustChangePassword = driver?.must_change_password === true;

  const role = resolveAuthoritativeRole({
    membershipRole: typeof membership?.role_in_company === 'string' ? membership.role_in_company : null,
    profileRole: typeof profile?.role === 'string' ? profile.role : null,
    isDriver: Boolean(driver) || profile?.is_driver === true,
    hasCreatedCompany: Boolean(creatorCompany),
    creatorCompanyType: typeof creatorCompany?.company_type === 'string' ? creatorCompany.company_type : null,
    fallbackRole,
  });

  let companyId =
    (typeof profile?.company_id === 'string' && profile.company_id) ||
    (typeof membership?.company_id === 'string' && membership.company_id) ||
    (typeof driver?.company_id === 'string' && driver.company_id) ||
    (typeof creatorCompany?.id === 'string' && creatorCompany.id) ||
    null;

  if (
    !companyId &&
    role &&
    shouldAutoProvisionCompany({
      fallbackRole,
      profileRole: typeof profile?.role === 'string' ? profile.role : null,
    })
  ) {
    const provisionRes = await callRpc('get_or_create_company_for_user');
    if (provisionRes.type === 'unauthenticated') {
      return { status: 'unauthenticated', role: null, companyId: null, mustChangePassword: false };
    }
    if (provisionRes.type === 'ok' && provisionRes.value) {
      companyId = provisionRes.value;
    }
  }

  if (!role) {
    if (profileLookupFailed) {
      return { status: 'error', role: null, companyId, mustChangePassword: false };
    }
    return { status: 'ok', role: null, companyId, mustChangePassword: false };
  }

  if (roleRequiresCompanyContext(role) && !companyId) {
    return { status: 'ok', role: null, companyId: null, mustChangePassword: false };
  }

  return { status: 'ok', role, companyId, mustChangePassword: role === 'driver' ? mustChangePassword : false };
};

const isAllowedForRoute = (pathname: string, role: UserRole | null): boolean => {
  if (!role) return false;
  if (pathname.startsWith('/admin')) return ADMIN_ROLES.has(role);
  if (pathname.startsWith('/driver')) return DRIVER_ROLES.has(role);
  if (pathname.startsWith('/m')) return MOBILE_ROLES.has(role);
  if (pathname.startsWith('/customer')) return CUSTOMER_ROLES.has(role);
  return true;
};

const redirectToForbidden = (request: NextRequest) => {
  const forbiddenUrl = new URL('/forbidden', request.url);
  return NextResponse.redirect(forbiddenUrl);
};

const redirectToLogin = (request: NextRequest) => {
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
};

const redirectToDriverPasswordChange = (request: NextRequest) => {
  const changeUrl = new URL('/driver/change-password', request.url);
  return NextResponse.redirect(changeUrl);
};

const createNonce = () => {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of nonceBytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const buildCspHeader = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://images.unsplash.com https://*.supabase.co",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self' https://app.netlify.com",
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ].join('; ');

const withSecurityHeaders = (response: NextResponse, nonce: string, cspHeader: string) => {
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);
  return response;
};

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const cspHeader = buildCspHeader(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);
  const allowRequest = () =>
    withSecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      nonce,
      cspHeader
    );

  const { pathname } = request.nextUrl;
  const requiresAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!requiresAuth) {
    return allowRequest();
  }

  if (!hasSupabaseAuthCookie(request)) {
    return allowRequest();
  }

  const token = extractAccessToken(request);
  if (!token) {
    return allowRequest();
  }

  const payload = decodeJwtPayload(token);
  const userId = typeof payload?.sub === 'string' ? payload.sub : null;
  if (!userId) {
    return allowRequest();
  }
  if (isJwtExpired(payload)) {
    return allowRequest();
  }

  const appMetadata =
    payload && typeof payload.app_metadata === 'object' && payload.app_metadata !== null
      ? (payload.app_metadata as Record<string, unknown>)
      : null;

  const fallbackRole =
    typeof appMetadata?.role === 'string'
      ? appMetadata.role
      : null;

  const snapshot = await fetchRoleSnapshot(token, userId, fallbackRole);
  if (snapshot.status === 'unauthenticated') {
    return allowRequest();
  }

  if (snapshot.status === 'error') {
    return allowRequest();
  }

  if (!isAllowedForRoute(pathname, snapshot.role)) {
    return withSecurityHeaders(redirectToForbidden(request), nonce, cspHeader);
  }

  if (snapshot.role === 'driver') {
    if (snapshot.mustChangePassword && pathname !== '/driver/change-password') {
      return withSecurityHeaders(redirectToDriverPasswordChange(request), nonce, cspHeader);
    }
    if (!snapshot.mustChangePassword && pathname === '/driver/change-password') {
      const jobsUrl = new URL('/driver/jobs', request.url);
      return withSecurityHeaders(NextResponse.redirect(jobsUrl), nonce, cspHeader);
    }
  }

  return allowRequest();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|webmanifest)$).*)',
  ],
};
