'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { useRouter } from 'next/navigation';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
};

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  email: string | null;
  status: string;
  company_type: string | null;
  created_at: string;
};

function VerificationContent() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); setLoading(false); return; }
      const res = await fetch('/api/super-admin/companies?status=pending', { headers: { Authorization: auth } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const data = await res.json() as { companies: Company[] };
      setCompanies(data.companies ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch_(); }, [fetch_]);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🪪</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Company Verification</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Companies
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Companies pending verification and approval ({loading ? '…' : companies.length} awaiting review).
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/super-admin/companies/approvals')}
          style={{ padding: '0.5rem 1rem', backgroundColor: THEME.accent, color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
        >
          Go to Approvals →
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid ${THEME.red}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.red, fontSize: '0.82rem', marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>Loading…</div>
        ) : companies.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>No companies awaiting verification.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                  {['Company name', 'Reg. number', 'Email', 'Type', 'Status', 'Submitted'].map((h) => (
                    <th key={h} style={{ padding: '0.75rem 0.9rem', textAlign: 'left', color: THEME.muted, fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((co) => (
                  <tr key={co.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.text, fontWeight: 600 }}>{co.name}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{co.company_number ?? '—'}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{co.email ?? '—'}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{co.company_type ?? 'standard'}</td>
                    <td style={{ padding: '0.75rem 0.9rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: THEME.orange, backgroundColor: 'rgba(249,115,22,0.1)', border: `1px solid ${THEME.orange}`, borderRadius: '4px', padding: '0.1rem 0.35rem' }}>
                        {co.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{fmt(co.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <VerificationContent />
    </ProtectedRoute>
  );
}
