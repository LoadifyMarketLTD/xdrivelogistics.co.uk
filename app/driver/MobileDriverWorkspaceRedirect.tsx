'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';

/** Prevent an authenticated phone driver from falling back to the desktop shell. */
export default function MobileDriverWorkspaceRedirect({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const redirect = !isLoading && user?.role === 'driver' && mobile === true && user.canAccessDriverMode === true && !user.mustChangePassword;
  useEffect(() => {
    if (redirect) router.replace('/driver-pwa-fresh/jobs');
  }, [redirect, router]);
  if (redirect) return <p role="status">Opening XDrive Driver mobile application...</p>;
  return <>{children}</>;
}
