import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/admin', '/m', '/driver/jobs'];

const hasSupabaseAuthCookie = (request: NextRequest) => {
  return request.cookies.getAll().some(
    (cookie) => cookie.name.includes('sb-') && cookie.name.includes('-auth-token')
  );
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiresAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!requiresAuth) return NextResponse.next();

  if (!hasSupabaseAuthCookie(request)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/m/:path*', '/driver/jobs/:path*'],
};
