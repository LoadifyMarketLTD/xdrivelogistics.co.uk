'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';

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
  pageBg: '#F4F6F8',
  cardBg: '#FFFFFF',
  cardBorder: '#D9E1EA',
  text: '#1A1F2B',
  heading: '#0B2F6B',
  blue: '#1D57D8',
  muted: '#64748B',
  accent: '#F5A300',
  green: '#16A34A',
  red: '#DC2626',
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
  const [pendingModal, setPendingModal] = useState<{ company: Company; action: ActionType } | null>(null);
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
        return;
      }

      const res = await fetch('/api/super-admin/companies?status=all', {
        headers: { Authorization: auth },
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError('Company governance service is currently unavailable.');
        return;
      }

      const payload = body as ApiResponse;
      setCompanies(payload.companies ?? []);
      setGovernanceHistoryAvailable(Boolean(payload.governanceHistoryAvailable));
      setGovernanceHistoryError(payload.governanceHistoryError ?? null);
      setGovernanceHistoryByCompany(payload.governanceHistoryByCompany ?? {});
      setGovernanceHistoryRecent(payload.governanceHistoryRecent ?? []);
    } catch {
      setError('Company governance service is currently unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCompanies();
  }, [fetchCompanies]);

  const handleAction = async (companyId: string, action: ActionType, reason = '') => {
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
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      if (!res.ok) {
        setMessage('The requested company action could not be completed.');
      } else {
        setMessage(`Action '${action}' applied successfully.`);
        await fetchCompanies();
      }
    } catch {
      setMessage('The requested company action could not be completed.');
    } finally {
      setActing(null);
    }
  };

  const initiateAction = (company: Company, action: ActionType) => {
    if (action === 'suspend' || action === 'reject') {
      setPendingModal({ company, action });
    } else {
      void handleAction(company.id, action);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <ActionConfirmModal
        open={pendingModal !== null}
        title={pendingModal?.action === 'suspend' ? '⛔ Suspend company' : '❌ Reject company'}
        description={
          pendingModal?.action === 'suspend'
            ? <><strong>{pendingModal.company.name}</strong> will be <strong style={{ color: THEME.red }}>suspended</strong> immediately. Drivers and brokers in this company will lose platform access.</>
            : <><strong>{pendingModal?.company.name}</strong> application will be <strong style={{ color: THEME.red }}>rejected</strong>. The applicant will be notified.</>
        }
        confirmLabel={pendingModal?.action === 'suspend' ? 'Confirm suspension' : 'Confirm rejection'}
        danger
        reasonRequired
        reasonPlaceholder={pendingModal?.action === 'suspend' ? 'Explain why this company is being suspended…' : 'Explain why this application is being rejected…'}
        submitting={acting !== null}
        onCancel={() => setPendingModal(null)}
        onConfirm={(reason) => {
          if (!pendingModal) return;
          setPendingModal(null);
          void handleAction(pendingModal.company.id, pendingModal.action, reason);
        }}
      />

      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, color: THEME.text, padding: '12px' }}>
        <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span aria-hidden="true" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', borderRadius: '4px', background: THEME.heading, color: '#FFFFFF', fontSize: '12px' }}>🏢</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '20px', lineHeight: 1.2, fontWeight: 800, color: THEME.heading, margin: 0 }}>All Companies Governance</h1>
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: THEME.blue, backgroundColor: '#EEF4FF', padding: '3px 6px', borderRadius: '4px' }}>Companies</span>
            </div>
            <p style={{ color: THEME.muted, margin: '4px 0 0', fontSize: '12px' }}>Platform-wide company register with governance actions and audit trail.</p>
          </div>
          <button onClick={() => void fetchCompanies()} disabled={loading} style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: `1px solid ${THEME.blue}`, background: THEME.blue, color: '#FFFFFF', fontWeight: 800, fontSize: '11px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1 }}>{loading ? 'Loading…' : 'Refresh'}</button>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          {[
            { label: 'Total', value: statusCounts.total },
            { label: 'Active', value: statusCounts.active },
            { label: 'Suspended', value: statusCounts.suspended },
            { label: 'Pending', value: statusCounts.pending },
            { label: 'Rejected', value: statusCounts.rejected },
          ].map((item) => (
            <div key={item.label} style={{ minHeight: '72px', backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '12px' }}>
              <div style={{ color: THEME.heading, fontSize: '20px', fontWeight: 800 }}>{item.value}</div>
              <div style={{ color: THEME.muted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '5px', fontWeight: 700 }}>{item.label}</div>
            </div>
          ))}
        </section>

        {message && <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.accent}`, borderLeft: `4px solid ${THEME.accent}`, borderRadius: '4px', padding: '9px 12px', color: THEME.text, fontSize: '11px', marginBottom: '12px' }}>{message}</div>}
        {error && <div role="alert" style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.red}`, borderLeft: `4px solid ${THEME.red}`, borderRadius: '4px', padding: '9px 12px', color: THEME.red, fontSize: '11px', fontWeight: 700, marginBottom: '12px' }}>{error}</div>}

        <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
          {loading ? (
            <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>Loading…</div>
          ) : companies.length === 0 ? (
            <div style={{ padding: '18px', textAlign: 'center', color: THEME.muted, fontSize: '12px' }}>No companies found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px', fontSize: '12px' }}>
                <thead>
                  <tr style={{ height: '38px', background: THEME.pageBg, borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    {['Company', 'Status', 'Type', 'Email', 'Created', 'Governance actions', 'Audit history'].map((heading) => (
                      <th key={heading} style={{ padding: '0 12px', textAlign: 'left', color: THEME.heading, fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const actions = getActionsForStatus(company.status);
                    const companyHistory = governanceHistoryByCompany[company.id] ?? [];
                    return (
                      <tr key={company.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                        <td style={{ padding: '9px 12px', color: THEME.text }}><div style={{ fontWeight: 800 }}>{company.name}</div><div style={{ fontSize: '10px', color: THEME.muted, marginTop: '2px' }}>Reg: {company.company_number ?? '—'}</div></td>
                        <td style={{ padding: '9px 12px' }}><StatusChip value={company.status} /></td>
                        <td style={{ padding: '9px 12px', color: THEME.text }}>{company.company_type ?? 'standard'}</td>
                        <td style={{ padding: '9px 12px', color: THEME.text }}>{company.email ?? '—'}</td>
                        <td style={{ padding: '9px 12px', color: THEME.text }}>{formatDateTime(company.created_at)}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {actions.length === 0 && <span style={{ color: THEME.muted, fontSize: '11px' }}>No action</span>}
                            {actions.map((action) => {
                              const isBusy = acting?.companyId === company.id && acting.action === action;
                              const danger = action === 'reject' || action === 'suspend';
                              return <button key={action} onClick={() => initiateAction(company, action)} disabled={Boolean(acting)} style={{ height: '30px', padding: '0 9px', borderRadius: '4px', border: `1px solid ${danger ? THEME.red : THEME.green}`, backgroundColor: '#FFFFFF', color: danger ? THEME.red : THEME.green, fontWeight: 800, fontSize: '10px', cursor: 'pointer', opacity: isBusy ? .6 : 1 }}>{isBusy ? '…' : action}</button>;
                            })}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', color: THEME.text }}>
                          {governanceHistoryAvailable ? (
                            companyHistory.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>{companyHistory.map((entry) => <div key={entry.id} style={{ fontSize: '10px' }}><span style={{ color: THEME.blue, fontWeight: 800 }}>{entry.action_type}</span><span style={{ color: THEME.muted }}> · {formatDateTime(entry.created_at)}</span></div>)}</div> : <span style={{ color: THEME.muted, fontSize: '11px' }}>No entries</span>
                          ) : <span style={{ color: THEME.muted, fontSize: '11px' }}>Audit history temporarily unavailable</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '12px' }}>
          <h2 style={{ margin: '0 0 8px', color: THEME.heading, fontSize: '13px', fontWeight: 800 }}>Recent Governance Events</h2>
          {!governanceHistoryAvailable ? (
            <p style={{ margin: 0, color: THEME.muted, fontSize: '11px' }}>Governance history is temporarily unavailable. {governanceHistoryError ? 'Diagnostics are available in the platform logs.' : ''}</p>
          ) : governanceHistoryRecent.length === 0 ? (
            <p style={{ margin: 0, color: THEME.muted, fontSize: '11px' }}>No governance events recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {governanceHistoryRecent.slice(0, 12).map((event) => <div key={event.id} style={{ fontSize: '11px', color: THEME.text }}><span style={{ color: THEME.blue, fontWeight: 800 }}>{event.action_type}</span><span style={{ color: THEME.muted }}> · {formatDateTime(event.created_at)} · {event.old_status} → {event.new_status}</span><div style={{ color: THEME.muted, marginTop: '2px' }}>{event.reason}</div></div>)}
            </div>
          )}
        </section>
      </div>
    </ProtectedRoute>
  );
}
