'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
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

type ActionState = { companyId: string; action: 'reject' } | null;

function ApprovalsContent() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active session.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/super-admin/companies?status=pending', {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `HTTP ${response.status}`);
        setLoading(false);
        return;
      }
      const data = await response.json() as { companies: Company[] };
      setCompanies(data.companies);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Fetch failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const rejectCompany = async (companyId: string) => {
    const reason = window.prompt('Reason for rejecting this company/onboarding application:');
    if (reason === null) return;
    if (!reason.trim()) {
      setActionMessage('A rejection reason is required.');
      return;
    }

    setActionState({ companyId, action: 'reject' });
    setActionMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setActionMessage('No active session.');
        setActionState(null);
        return;
      }

      const response = await fetch(`/api/super-admin/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ action: 'reject', reason: reason.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActionMessage((body as { error?: string }).error ?? `HTTP ${response.status}`);
      } else {
        setActionMessage('Company and linked onboarding application rejected.');
        await fetchPending();
      }
    } catch (reasonValue) {
      setActionMessage(reasonValue instanceof Error ? reasonValue.message : 'Action failed.');
    } finally {
      setActionState(null);
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.5rem' }}>✅</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Approvals Queue</h1>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
              Compliance required
            </span>
          </div>
          <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Open each application, verify its private evidence, then approve only when every mandatory document is green.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: `1px solid ${THEME.accent}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.accent, fontSize: '0.82rem', marginBottom: '1rem' }}>
          {actionMessage}
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid ${THEME.red}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.red, fontSize: '0.82rem', marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>Loading…</div>
        ) : companies.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>
            No companies pending approval.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 760 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                {['Company name', 'Reg. number', 'Email', 'Type', 'Applied', 'Actions'].map((heading) => (
                  <th key={heading} style={{ padding: '0.75rem 0.9rem', textAlign: 'left', color: THEME.muted, fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const isActing = actionState?.companyId === company.id;
                return (
                  <tr key={company.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.text, fontWeight: 600 }}>{company.name}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{company.company_number ?? '—'}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{company.email ?? '—'}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{company.company_type ?? 'standard'}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{formatDate(company.created_at)}</td>
                    <td style={{ padding: '0.75rem 0.9rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => router.push(`/super-admin/companies/approvals/${encodeURIComponent(company.id)}`)}
                          disabled={isActing}
                          style={{ padding: '0.38rem 0.7rem', borderRadius: '6px', border: 'none', backgroundColor: THEME.blue, color: '#fff', fontWeight: 800, fontSize: '0.72rem', cursor: isActing ? 'not-allowed' : 'pointer' }}
                        >
                          Review evidence
                        </button>
                        <button
                          onClick={() => void rejectCompany(company.id)}
                          disabled={isActing}
                          style={{ padding: '0.38rem 0.7rem', borderRadius: '6px', border: `1px solid ${THEME.red}`, backgroundColor: 'transparent', color: THEME.red, fontWeight: 700, fontSize: '0.72rem', cursor: isActing ? 'not-allowed' : 'pointer', opacity: isActing ? 0.6 : 1 }}
                        >
                          {isActing ? 'Rejecting…' : 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <ApprovalsContent />
    </ProtectedRoute>
  );
}
