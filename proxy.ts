import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

const mapRole = (value: string | null | undefined): UserRole | null => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'owner') return 'owner';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'company' || normalized === 'dispatcher') return 'company';
  if (normalized === 'driver') return 'driver';
  if (normalized === 'customer' || normalized === 'client' || normalized === 'viewer') return 'customer';
  return null;
};

const resolveRole = ({
  membershipRole,
  profileRole,
  isDriver,
  hasCreatedCompany,
  creatorCompanyType,
  fallbackRole,
}: {
  membershipRole?: string | null;
  profileRole?: string | null;
  isDriver: boolean;
  hasCreatedCompany: boolean;
  creatorCompanyType?: string | null;
  fallbackRole?: string | null;
}): UserRole | null => {
  if (membershipRole === 'owner') return 'owner';
  if (membershipRole === 'admin') return 'admin';
  if (membershipRole === 'dispatcher') return 'company';
  if (isDriver) return 'driver';
  if (membershipRole === 'viewer') return 'customer';
  if (hasCreatedCompany) return creatorCompanyType === 'admin' ? 'admin' : 'owner';

  const resolvedProfileRole = mapRole(profileRole);
  if (resolvedProfileRole) return resolvedProfileRole;

  const resolvedFallbackRole = mapRole(fallbackRole);
  if (resolvedFallbackRole) return resolvedFallbackRole;

  return null;
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

  if ([profileRes, membershipRes, driverRes, creatorCompanyRes].some((result) => result.type === 'unauthenticated')) {
    return { status: 'unauthenticated', role: null, companyId: null, mustChangePassword: false };
  }
  if ([profileRes, membershipRes, driverRes, creatorCompanyRes].some((result) => result.type !== 'ok')) {
    return { status: 'error', role: null, companyId: null, mustChangePassword: false };
  }

  const profile = profileRes.rows?.[0] ?? null;
  const membership = membershipRes.rows?.[0] ?? null;
  const driver = driverRes.rows?.[0] ?? null;
  const creatorCompany = creatorCompanyRes.rows?.[0] ?? null;
  const mustChangePassword = driver?.must_change_password === true;

  const role = resolveRole({
    membershipRole: typeof membership?.role_in_company === 'string' ? membership.role_in_company : null,
    profileRole: typeof profile?.role === 'string' ? profile.role : null,
    isDriver: Boolean(driver) || profile?.is_driver === true,
    hasCreatedCompany: Boolean(creatorCompany),
    creatorCompanyType: typeof creatorCompany?.company_type === 'string' ? creatorCompany.company_type : null,
    fallbackRole,
  });

  let companyId =
    (typeof driver?.company_id === 'string' && driver.company_id) ||
    (typeof profile?.company_id === 'string' && profile.company_id) ||
    (typeof membership?.company_id === 'string' && membership.company_id) ||
    (typeof creatorCompany?.id === 'string' && creatorCompany.id) ||
    null;

  if (!companyId && (role === 'company' || role === 'admin' || role === 'owner')) {
    const provisionRes = await callRpc('get_or_create_company_for_user');
    if (provisionRes.type === 'unauthenticated') {
      return { status: 'unauthenticated', role: null, companyId: null, mustChangePassword: false };
    }
    if (provisionRes.type === 'ok' && provisionRes.value) {
      companyId = provisionRes.value;
    }
  }

  if (!role) {
    return { status: 'ok', role: null, companyId, mustChangePassword: false };
  }

  if ((role === 'company' || role === 'admin' || role === 'owner' || role === 'driver') && !companyId) {
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

const redirectToLogin = (request: NextRequest) => {
  const loginUrl = new URL('/login', request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('next', nextPath);
  return NextResponse.redirect(loginUrl);
};

const redirectToForbidden = (request: NextRequest) => {
  const forbiddenUrl = new URL('/forbidden', request.url);
  return NextResponse.redirect(forbiddenUrl);
};

const redirectToDriverPasswordChange = (request: NextRequest) => {
  const changeUrl = new URL('/driver/change-password', request.url);
  return NextResponse.redirect(changeUrl);
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiresAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!requiresAuth) return NextResponse.next();

  if (!hasSupabaseAuthCookie(request)) {
    return redirectToLogin(request);
  }

  const token = extractAccessToken(request);
  if (!token) {
    return redirectToLogin(request);
  }

  const payload = decodeJwtPayload(token);
  const userId = typeof payload?.sub === 'string' ? payload.sub : null;
  if (!userId) {
    return redirectToLogin(request);
  }
  if (isJwtExpired(payload)) {
    return redirectToLogin(request);
  }

  // SECURITY: Only use app_metadata.role as the fallback for route-access decisions.
  // user_metadata is end-user writable (supabase.auth.updateUser can set it), so
  // trusting user_metadata.role here would allow privilege escalation. app_metadata
  // is writable only by the service role and is safe to use as a fallback hint.
  const appMetadata =
    payload && typeof payload.app_metadata === 'object' && payload.app_metadata !== null
      ? (payload.app_metadata as Record<string, unknown>)
      : null;

  const fallbackRole = typeof appMetadata?.role === 'string' ? appMetadata.role : null;

  const snapshot = await fetchRoleSnapshot(token, userId, fallbackRole);
  if (snapshot.status === 'unauthenticated') {
    return redirectToLogin(request);
  }

  if (snapshot.status === 'error') {
    return redirectToForbidden(request);
  }

  if (!isAllowedForRoute(pathname, snapshot.role)) {
    return redirectToForbidden(request);
  }

  if (snapshot.role === 'driver') {
    if (snapshot.mustChangePassword && pathname !== '/driver/change-password') {
      return redirectToDriverPasswordChange(request);
    }
    if (!snapshot.mustChangePassword && pathname === '/driver/change-password') {
      const jobsUrl = new URL('/driver/jobs', request.url);
      return NextResponse.redirect(jobsUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/m/:path*', '/driver/:path*', '/customer/:path*'],
};
