'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, type UserRole } from './AuthContext';
import { isRoleAllowedForPath, mapAppRole } from '../../lib/authRole';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '/';

  const routeAccessAllowed = useMemo(() => {
    if (!user) return false;

    const role = mapAppRole(user.role);
    const listedRoleAllowed = allowedRoles?.length
      ? allowedRoles.includes(user.role) ||
        (allowedRoles.includes('driver') && user.canAccessDriverMode === true)
      : true;

    if (!listedRoleAllowed) return false;

    // Middleware already treats a membership-less Driver with an explicitly
    // validated active driver row as a standalone Driver portal identity.
    // Mirror that server-side normalization here so client hydration cannot
    // turn the same valid session into a false /forbidden redirect.
    const companyStatusForAccess =
      user.role === 'driver' && user.membershipId == null && user.companyStatus == null
        ? 'active'
        : user.companyStatus ?? null;

    return isRoleAllowedForPath(pathname, role, {
      canAccessDriverMode: user.canAccessDriverMode === true,
      membershipId: user.membershipId ?? null,
      membershipRole: user.membershipRole ?? null,
      financeAccess: user.financeAccess ?? null,
      ownerDriverWorkspace: user.ownerDriverWorkspace === true,
      ownerDriverExecutionMode: user.ownerDriverExecutionMode === true,
      rawRole: user.rawRole ?? null,
      workspaceRole: user.workspaceRole ?? null,
      driverId: user.driverId ?? null,
      canCommercialBid: user.canCommercialBid,
      driverStatus: user.driverStatus ?? null,
      appAccess: user.appAccess,
      accountStatus: user.accountStatus ?? null,
      companyStatus: companyStatusForAccess,
    });
  }, [allowedRoles, pathname, user]);

  useEffect(() => {
    if (!isLoading && !user) {
      const loginPath = pathname ? `/login?next=${encodeURIComponent(pathname)}` : '/login';
      if (pathname !== '/login') router.replace(loginPath);
      return;
    }

    if (!isLoading && user && !routeAccessAllowed && pathname !== '/forbidden') {
      router.replace('/forbidden');
    }
  }, [user, isLoading, router, pathname, routeAccessAllowed]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          fontSize: '1.25rem',
          color: '#2563eb',
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user || !routeAccessAllowed) return null;
  return <>{children}</>;
}
