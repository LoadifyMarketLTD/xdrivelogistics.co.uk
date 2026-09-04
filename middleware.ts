import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// DIAGNOSTIC PREVIEW ONLY.
// This intentionally removes all auth/data imports to isolate whether the
// Netlify middleware bundle is causing the production-style HTTP 500.
// Never merge this file into production.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/super-admin/:path*',
    '/broker/:path*',
    '/admin/:path*',
    '/driver/:path*',
    '/customer/:path*',
    '/m/:path*',
  ],
};
