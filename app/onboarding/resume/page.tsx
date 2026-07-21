'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classifyOnboardingLifecycleStatus } from '../../../lib/accessLifecycle';
import {
  getOnboardingPathForAccountType,
  type AccountType,
} from '../../../lib/accountTypes';
import { supabase } from '../../../lib/supabaseClient';

type InitPayload = {
  error?: string;
  status?: string;
  accountType?: AccountType;
  resumeAllowed?: boolean;
  invitationRevoked?: boolean;
  invitationResent?: boolean;
  tokenExpiresAt?: string | null;
};

export default function OnboardingResumePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revoked, setRevoked] = useState(false);
  const [working, setWorking] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const initialize = async (forceRegenerateToken: boolean) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.replace('/login?next=/onboarding/resume');
      return null;
    }

    const response = await fetch('/api/onboarding/init', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ forceRegenerateToken }),
    });
    const payload = (await response.json().catch(() => null)) as InitPayload | null;

    if (!response.ok || !payload?.accountType) {
      throw new Error(payload?.error ?? 'Unable to resume onboarding. Please sign in again or contact support.');
    }

    return payload;
  };

  const routeFromPayload = (payload: InitPayload) => {
    if (!payload.accountType) return;
    setAccountType(payload.accountType);

    const lifecycle = classifyOnboardingLifecycleStatus(payload.status);
    if (lifecycle === 'approved') {
      router.replace('/login');
      return;
    }
    if (lifecycle === 'review') {
      router.replace('/pending-approval');
      return;
    }
    if (lifecycle === 'rejected') {
      router.replace('/forbidden?reason=onboarding-rejected');
      return;
    }
    if (lifecycle === 'unknown') {
      setError('This onboarding application has an unsupported status. Please contact XDrive support.');
      return;
    }
    if (payload.resumeAllowed === false || payload.invitationRevoked) {
      setRevoked(true);
      return;
    }

    router.replace(getOnboardingPathForAccountType(payload.accountType));
  };

  useEffect(() => {
    let cancelled = false;

    void initialize(false)
      .then((payload) => {
        if (!cancelled && payload) routeFromPayload(payload);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to resume onboarding.');
      });

    return () => {
      cancelled = true;
    };
    // The route decision runs only once when this resolver page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resendInvitation = async () => {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const payload = await initialize(true);
      if (!payload) return;
      setRevoked(false);
      setMessage('A new secure onboarding invitation has been issued. Opening your application…');
      window.setTimeout(() => {
        const nextAccountType = payload.accountType ?? accountType;
        if (nextAccountType) {
          router.replace(getOnboardingPathForAccountType(nextAccountType));
        }
      }, 700);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to resend the invitation.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#f4f6f8' }}>
      <section style={{ width: '100%', maxWidth: 560, border: '1px solid #d7e0ea', borderRadius: 14, background: '#fff', padding: '2rem', textAlign: 'center', boxShadow: '0 12px 30px rgba(15,23,42,0.08)' }}>
        <h1 style={{ margin: 0, color: '#0b2f6b' }}>{revoked ? 'Invitation revoked' : 'Preparing your onboarding'}</h1>
        <p role={error ? 'alert' : undefined} style={{ color: error ? '#b91c1c' : message ? '#166534' : '#64748b', lineHeight: 1.6, marginBottom: revoked ? '1rem' : 0 }}>
          {error || message || (revoked
            ? 'This onboarding link was revoked and will not be regenerated automatically. Issue a new secure invitation to continue.'
            : 'We are opening the correct application and restoring your saved progress.')}
        </p>
        {revoked && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={working}
              onClick={() => void resendInvitation()}
              style={{ border: 0, borderRadius: 8, background: '#1d4ed8', color: '#fff', padding: '0.72rem 1rem', fontWeight: 800, cursor: working ? 'wait' : 'pointer' }}
            >
              {working ? 'Issuing invitation…' : 'Resend invitation'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              style={{ border: '1px solid #d7e0ea', borderRadius: 8, background: '#fff', color: '#0f172a', padding: '0.72rem 1rem', fontWeight: 800, cursor: 'pointer' }}
            >
              Back to sign in
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
