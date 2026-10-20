'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';

type AccountType = 'customer_shipper' | 'broker_shipper' | 'fleet_courier' | 'individual_driver' | 'owner_driver';

const routeByAccountType: Record<AccountType, string> = {
  customer_shipper: '/onboarding/customer/resume',
  broker_shipper: '/onboarding/broker/resume',
  fleet_courier: '/onboarding/fleet/resume',
  individual_driver: '/onboarding/individual-driver/resume',
  owner_driver: '/onboarding/owner-driver/resume',
};

export default function OnboardingResumePage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const resolveResumeRoute = async () => {
      let accessToken = readRouteAuthAccessToken();
      if (!accessToken) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Session lookup timed out. Please reload and sign in again.')), 15000); }),
        ]).finally(() => { if (timer) clearTimeout(timer); });
        if (result.error) throw result.error;
        accessToken = result.data.session?.access_token ?? null;
      }
      if (!accessToken) {
        router.replace('/login?next=/onboarding/resume');
        return;
      }

      const response = await fetch('/api/onboarding/init', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceRegenerateToken: false, resumeOnly: true }),
        signal: AbortSignal.timeout(30000),
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        status?: string;
        accountType?: AccountType;
      } | null;

      if (cancelled) return;
      if (!response.ok || !payload?.accountType) {
        setError(payload?.error ?? 'Unable to resume onboarding. Please sign in again or contact support.');
        return;
      }

      const status = String(payload.status ?? '').toLowerCase();
      if (status === 'approved') {
        router.replace('/login');
        return;
      }
      if (['submitted', 'under_review', 'compliance_review', 'admin_approval'].includes(status)) {
        router.replace('/pending-approval');
        return;
      }
      if (status === 'rejected') {
        router.replace('/forbidden?reason=onboarding-rejected');
        return;
      }

      router.replace(routeByAccountType[payload.accountType]);
    };

    void resolveResumeRoute().catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : 'Unable to resume onboarding.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#f4f6f8' }}>
      <section style={{ width: '100%', maxWidth: 560, border: '1px solid #d7e0ea', borderRadius: 14, background: '#fff', padding: '2rem', textAlign: 'center', boxShadow: '0 12px 30px rgba(15,23,42,0.08)' }}>
        <h1 style={{ margin: 0, color: '#0b2f6b' }}>Preparing your onboarding</h1>
        <p style={{ color: error ? '#b91c1c' : '#64748b', lineHeight: 1.6, marginBottom: 0 }}>
          {error || 'We are opening the correct application and restoring your saved progress.'}
        </p>
      </section>
    </main>
  );
}
