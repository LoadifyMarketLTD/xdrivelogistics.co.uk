'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { classifyOnboardingLifecycleStatus, getOnboardingLifecycleRoute } from '../../lib/accessLifecycle';
import { supabase } from '../../lib/supabaseClient';

const workspacePrefixes = ['/admin', '/broker', '/customer', '/driver', '/dashboard'];

export default function OnboardingAccessGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!workspacePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return;
    }

    let cancelled = false;
    const verifyAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.access_token) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const response = await fetch('/api/onboarding/init', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      }).catch(() => null);

      if (cancelled) return;
      if (!response) {
        router.replace('/forbidden?reason=onboarding-check-unavailable');
        return;
      }

      // Legacy/internal accounts without a public onboarding application retain
      // their existing workspace access. Public signups always create one.
      if (response.status === 404) return;
      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!response.ok) {
        router.replace('/forbidden?reason=onboarding-check-failed');
        return;
      }

      const payload = await response.json().catch(() => null) as { status?: string } | null;
      const state = classifyOnboardingLifecycleStatus(payload?.status);
      if (state === 'approved') return;

      const route = getOnboardingLifecycleRoute(payload?.status);
      if (route) {
        router.replace(route);
        return;
      }

      router.replace('/forbidden?reason=onboarding-status-invalid');
    };

    void verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
