'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { getPostLoginRoute } from '../../lib/authSession';

/**
 * Silently redirects authenticated users to their dashboard.
 * Renders nothing — never blocks the server-rendered landing page.
 */
export function AuthRedirectGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push(getPostLoginRoute(user));
    }
  }, [user, isLoading, router]);

  return null;
}
