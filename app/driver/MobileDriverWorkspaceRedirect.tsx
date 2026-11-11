'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../components/AuthContext';
import { isMobileDriverBrowser } from '../../lib/isMobileDriverBrowser';

/** Prevent an authenticated phone driver from falling back to the desktop shell. */
export default function MobileDriverWorkspaceRedirect({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(isMobileDriverBrowser());
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const redirect = !isLoading && mobile === true && user?.canAccessDriverMode === true && (user.role === 'driver' || user.workspaceRole === 'owner_driver' || user.ownerDriverWorkspace === true) && !user.mustChangePassword;
  useEffect(() => {
    if (redirect) window.location.replace('/driver/reserve-pwa/index.html?live=1');
  }, [redirect]);
  if (redirect) return <p role="status">Opening XDrive Driver mobile application...</p>;
  return <>{children}</>;
}
