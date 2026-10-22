'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { getResponsivePostLoginRoute } from '../../lib/authSession';

/**
 * Silently redirects authenticated users to their dashboard.
 * Renders nothing — never blocks the server-rendered landing page.
 */
export function AuthRedirectGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push(getResponsivePostLoginRoute(user, window.matchMedia('(max-width: 767px)').matches));
    }
  }, [user, isLoading, router]);

  return null;
}
