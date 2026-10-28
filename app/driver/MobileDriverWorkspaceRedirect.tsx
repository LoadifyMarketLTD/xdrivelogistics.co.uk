'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';

/** Mobile driver deep links must not strand drivers in the desktop workspace. */
export default function MobileDriverWorkspaceRedirect({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user || user.mustChangePassword) return;
    if (user.role !== 'driver' || !user.canAccessDriverMode) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    // The driver PWA is a separate mobile shell; desktop and company roles retain /driver.
    if (pathname === '/driver' || pathname === '/driver/jobs') {
      router.replace('/driver-pwa-fresh/bookings');
    }
  }, [isLoading, user, pathname, router]);

  return <>{children}</>;
}
