'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  email: string | null;
  status: string;
  company_type: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  target_company_id: string;
  action_type: string;
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
};

type ActionType = 'approve' | 'reject' | 'suspend' | 'reinstate';

type ApiResponse = {
  companies: Company[];
  governanceHistoryAvailable?: boolean;
  governanceHistoryError?: string | null;
  governanceHistoryByCompany?: Record<string, AuditRow[]>;
  governanceHistoryRecent?: AuditRow[];
};

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
};

function isPendingCompanyStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === 'pending' || normalized === 'pending_approval';
}

function getActionsForStatus(status: string): ActionType[] {
  if (isPendingCompanyStatus(status)) return ['approve', 'reject'];
  const normalized = status.toLowerCase();
  if (normalized === 'active') return ['suspend'];
  if (normalized === 'suspended') return ['reinstate'];
  return [];
}

export default function Page() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acting, setActing] = useState<{ companyId: string; action: ActionType } | null>(null);
  const [governanceHistoryAvailable, setGovernanceHistoryAvailable] = useState(false);
  const [governanceHistoryError, setGovernanceHistoryError] = useState<string | null>(null);
  const [governanceHistoryByCompany, setGovernanceHistoryByCompany] = useState<Record<string, AuditRow[]>>({});
  const [governanceHistoryRecent, setGovernanceHistoryRecent] = useState<AuditRow[]>([]);

  const statusCounts = useMemo(() => {
    const counts = { total: companies.length, active: 0, suspended: 0, pending: 0, rejected: 0 };
    companies.forEach((company) => {
      const status = company.status.toLowerCase();
      if (status === 'active') counts.active += 1;
      if (status === 'suspended') counts.suspended += 1;
      if (isPendingCompanyStatus(status)) counts.pending += 1;
      if (status === 'rejected') counts.rejected += 1;
    });
    return counts;
  }, [companies]);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active session.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/super-admin/companies?status=all', {
        headers: { Authorization: auth },
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        setLoading(false);
        return;
      }

      const payload = body as ApiResponse;
      setCompanies(payload.companies ?? []);
      setGovernanceHistoryAvailable(Boolean(payload.governanceHistoryAvailable));
      setGovernanceHistoryError(payload.governanceHistoryError ?? null);
      setGovernanceHistoryByCompany(payload.governanceHistoryByCompany ?? {});
      setGovernanceHistoryRecent(payload.governanceHistoryRecent ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCompanies();
  }, [fetchCompanies]);

  const handleAction = async (companyId: string, action: ActionType) => {
    setActing({ companyId, action });
    setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setMessage('No active session.');
        setActing(null);
        return;
      }

      const res = await fetch(`/api/super-admin/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((body as { error?: string }).error ?? `HTTP ${res.status}`);
      } else {
        setMessage(`Action '${action}' applied successfully.`);
        await fetchCompanies();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActing(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>🏢</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>All Companies Governance</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Companies
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Platform-wide company register with governance actions and audit trail.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.7rem', marginBottom: '1rem' }}>
          {[
            { label: 'Total', value: statusCounts.total },
            { label: 'Active', value: statusCounts.active },
            { label: 'Suspended', value: statusCounts.suspended },
            { label: 'Pending', value: statusCounts.pending },
            { label: 'Rejected', value: statusCounts.rejected },
          ].map((item) => (
            <div key={item.label} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.75rem' }}>
              <div style={{ color: THEME.text, fontSize: '1.1rem', fontWeight: 700 }}>{item.value}</div>
              <div style={{ color: THEME.muted, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {message && (
          <div style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: `1px solid ${THEME.accent}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.accent, fontSize: '0.82rem', marginBottom: '1rem' }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid ${THEME.red}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.red, fontSize: '0.82rem', marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>Loading…</div>
          ) : companies.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>No companies found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    {['Company', 'Status', 'Type', 'Email', 'Created', 'Governance actions', 'Audit history'].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: '0.75rem 0.9rem',
                          textAlign: 'left',
                          color: THEME.muted,
                          fontWeight: 600,
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const actions = getActionsForStatus(company.status);
                    const companyHistory = governanceHistoryByCompany[company.id] ?? [];
                    return (
                      <tr key={company.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>
                          <div style={{ fontWeight: 700 }}>{company.name}</div>
                          <div style={{ fontSize: '0.72rem', color: THEME.muted, marginTop: '0.2rem' }}>
                            Reg: {company.company_number ?? '—'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem' }}>
                          <StatusChip value={company.status} />
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>{company.company_type ?? 'standard'}</td>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>{company.email ?? '—'}</td>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>{formatDateTime(company.created_at)}</td>
                        <td style={{ padding: '0.75rem 0.9rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {actions.length === 0 && (
                              <span style={{ color: THEME.muted, fontSize: '0.74rem' }}>No action</span>
                            )}
                            {actions.map((action) => {
                              const isBusy = acting?.companyId === company.id && acting.action === action;
                              const danger = action === 'reject' || action === 'suspend';
                              return (
                                <button
                                  key={action}
                                  onClick={() => void handleAction(company.id, action)}
                                  disabled={Boolean(acting)}
                                  style={{
                                    padding: '0.28rem 0.6rem',
                                    borderRadius: '6px',
                                    border: `1px solid ${danger ? THEME.red : THEME.green}`,
                                    backgroundColor: 'transparent',
                                    color: danger ? THEME.red : THEME.green,
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                    opacity: isBusy ? 0.6 : 1,
                                  }}
                                >
                                  {isBusy ? '…' : action}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.9rem', color: THEME.text }}>
                          {governanceHistoryAvailable ? (
                            companyHistory.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {companyHistory.map((entry) => (
                                  <div key={entry.id} style={{ fontSize: '0.72rem' }}>
                                    <span style={{ color: THEME.accent, fontWeight: 700 }}>{entry.action_type}</span>
                                    <span style={{ color: THEME.muted }}> · {formatDateTime(entry.created_at)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: THEME.muted, fontSize: '0.74rem' }}>No entries</span>
                            )
                          ) : (
                            <span style={{ color: THEME.red, fontSize: '0.74rem' }}>
                              Audit unavailable{governanceHistoryError ? `: ${governanceHistoryError}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', padding: '0.9rem' }}>
          <h2 style={{ margin: '0 0 0.6rem', color: THEME.text, fontSize: '0.92rem' }}>Recent Governance Events</h2>
          {!governanceHistoryAvailable ? (
            <p style={{ margin: 0, color: THEME.red, fontSize: '0.8rem' }}>
              Governance history table is unavailable{governanceHistoryError ? `: ${governanceHistoryError}` : ''}.
            </p>
          ) : governanceHistoryRecent.length === 0 ? (
            <p style={{ margin: 0, color: THEME.muted, fontSize: '0.8rem' }}>No governance events recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {governanceHistoryRecent.slice(0, 12).map((event) => (
                <div key={event.id} style={{ fontSize: '0.78rem', color: THEME.text }}>
                  <span style={{ color: THEME.accent, fontWeight: 700 }}>{event.action_type}</span>
                  <span style={{ color: THEME.muted }}> · {formatDateTime(event.created_at)} · {event.old_status} → {event.new_status}</span>
                  <div style={{ color: THEME.muted, marginTop: '0.1rem' }}>{event.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
