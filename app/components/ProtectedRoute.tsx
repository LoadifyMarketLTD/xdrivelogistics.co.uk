'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    if (!isLoading && !user) {
      const loginPath = pathname ? `/login?next=${encodeURIComponent(pathname)}` : '/login';
      if (pathname !== '/login') {
        router.replace(loginPath);
      }
      return;
    }

    if (!isLoading && user) {
      const role = mapAppRole(user.role);
      const roleAllowedByList = allowedRoles?.length
        ? (
            allowedRoles.includes(user.role) ||
            (allowedRoles.includes('driver') && user.canAccessDriverMode === true)
          )
        : null;
      const routeContext = {
        canAccessDriverMode: user.canAccessDriverMode === true,
        membershipRole: user.membershipRole ?? null,
        financeAccess: user.financeAccess ?? null,
      };
      const routeAllowed = isRoleAllowedForPath(pathname, role, routeContext);
      const hasAccess = allowedRoles?.length
        ? roleAllowedByList === true && routeAllowed
        : routeAllowed;
      if (!hasAccess && pathname !== '/forbidden') {
        router.replace('/forbidden');
      }
    }
  }, [user, isLoading, router, allowedRoles, pathname]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '1.25rem',
        color: '#2563eb'
      }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const role = mapAppRole(user.role);
  const roleAllowedByList = allowedRoles?.length
    ? (
        allowedRoles.includes(user.role) ||
        (allowedRoles.includes('driver') && user.canAccessDriverMode === true)
      )
    : null;
  const routeContext = {
    canAccessDriverMode: user.canAccessDriverMode === true,
    membershipRole: user.membershipRole ?? null,
    financeAccess: user.financeAccess ?? null,
  };
  const routeAllowed = isRoleAllowedForPath(pathname, role, routeContext);
  const hasAccess = allowedRoles?.length
    ? roleAllowedByList === true && routeAllowed
    : routeAllowed;

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
