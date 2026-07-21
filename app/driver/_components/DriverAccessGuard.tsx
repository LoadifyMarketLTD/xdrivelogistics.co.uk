'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';

type AccessPayload = {
  allowed?: boolean;
  businessWorkspaceOnly?: boolean;
  error?: string;
  missingDocuments?: string[];
  unverifiedDocuments?: string[];
  expiredDocuments?: string[];
};

const humanize = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export default function DriverAccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [payload, setPayload] = useState<AccessPayload>({});

  useEffect(() => {
    const requiresDriverApproval = Boolean(
      user?.role === 'driver' ||
      user?.ownerDriverWorkspace ||
      user?.canAccessDriverMode ||
      user?.ownerDriverExecutionMode
    );

    if (!requiresDriverApproval) {
      setAllowed(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const validate = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (!cancelled) {
          setPayload({ error: 'Your session has expired.' });
          setAllowed(false);
          setLoading(false);
        }
        return;
      }

      const response = await fetch('/api/driver/access', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const result = (await response.json().catch(() => ({}))) as AccessPayload;
      if (cancelled) return;

      setPayload(result);
      setAllowed(response.ok && result.allowed === true);
      setLoading(false);
    };

    void validate();
    return () => {
      cancelled = true;
    };
  }, [user?.canAccessDriverMode, user?.ownerDriverExecutionMode, user?.ownerDriverWorkspace, user?.role]);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f6f8', color: '#64748b' }}>Verifying driver access…</div>;
  }

  if (allowed) return <>{children}</>;

  const problems = [
    ...(payload.missingDocuments ?? []).map((value) => `Missing: ${humanize(value)}`),
    ...(payload.unverifiedDocuments ?? []).map((value) => `Not verified: ${humanize(value)}`),
    ...(payload.expiredDocuments ?? []).map((value) => `Expired: ${humanize(value)}`),
  ];

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem', background: '#f4f6f8' }}>
      <section style={{ width: '100%', maxWidth: 620, background: '#fff', border: '1px solid #fecaca', borderRadius: 14, padding: '1.4rem', boxShadow: '0 12px 30px rgba(15,23,42,0.08)' }}>
        <h1 style={{ margin: 0, color: '#991b1b', fontSize: '1.35rem' }}>Driver access unavailable</h1>
        <p style={{ color: '#475569', lineHeight: 1.6 }}>
          {payload.error ?? 'Your driver record is not currently approved for application access.'}
        </p>
        {problems.length > 0 && (
          <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 9, padding: '0.75rem', marginBottom: '1rem' }}>
            {problems.map((problem) => <div key={problem} style={{ color: '#92400e', fontSize: '0.82rem', marginBottom: '0.2rem' }}>{problem}</div>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/pending-approval')}
            style={{ border: 0, borderRadius: 8, background: '#1d57d8', color: '#fff', padding: '0.65rem 0.85rem', fontWeight: 850, cursor: 'pointer' }}
          >
            View approval status
          </button>
          <button
            onClick={() => void logout()}
            style={{ border: '1px solid #d7e0ea', borderRadius: 8, background: '#fff', color: '#0f172a', padding: '0.65rem 0.85rem', fontWeight: 850, cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
