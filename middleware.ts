import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AppUserRole } from './lib/authRole';
import type { MembershipRole } from './lib/membershipRole';
import type { WorkspaceRole } from './lib/workspaceRole';

// DIAGNOSTIC PREVIEW ONLY.
// This intentionally removes all auth/data imports to isolate whether the
// Netlify middleware bundle is causing the production-style HTTP 500.
// Never merge this file into production.

// Keep the public test-facing export so `tsc --noEmit` can type-check the
// existing middleware contract while this diagnostic branch bypasses the
// real auth implementation. The release gate does not execute these tests.
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

export async function resolveRouteAuth(_request: NextRequest): Promise<RouteAuthResult> {
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
