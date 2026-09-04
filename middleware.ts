import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// DIAGNOSTIC PREVIEW ONLY.
// This intentionally removes all auth/data imports to isolate whether the
// Netlify middleware bundle is causing the production-style HTTP 500.
// Never merge this file into production.

// Keep the public test-facing export so `tsc --noEmit` can type-check the
// existing middleware contract while this diagnostic branch bypasses the
// real auth implementation. The release gate does not execute these tests.
export async function resolveRouteAuth(_request: NextRequest) {
  return { kind: 'unauthenticated' as const };
}

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
