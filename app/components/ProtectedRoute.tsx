'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, type UserRole } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const inferAllowedRoles = (): UserRole[] | null => {
    if (allowedRoles?.length) return allowedRoles;
    if (pathname.startsWith('/admin') || pathname.startsWith('/m')) {
      return ['company', 'admin', 'owner'];
    }
    if (pathname.startsWith('/driver')) {
      return ['driver'];
    }
    if (pathname.startsWith('/customer')) {
      return ['customer'];
    }
    return null;
  };

  const effectiveAllowedRoles = inferAllowedRoles();

  useEffect(() => {
    if (!isLoading && !user) {
      const loginPath = pathname ? `/login?next=${encodeURIComponent(pathname)}` : '/login';
      if (pathname !== '/login') {
        router.replace(loginPath);
      }
      return;
    }

    if (!isLoading && user && effectiveAllowedRoles && !effectiveAllowedRoles.includes(user.role)) {
      if (pathname !== '/forbidden') {
        router.replace('/forbidden');
      }
    }
  }, [user, isLoading, router, effectiveAllowedRoles, pathname]);

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

  if (effectiveAllowedRoles && !effectiveAllowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
