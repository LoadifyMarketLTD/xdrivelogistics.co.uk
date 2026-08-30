'use client';

import { useCallback, useEffect, useState } from 'react';

import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type ReviewAction = 'approve' | 'request_changes' | 'reject';

type OnboardingRow = {
  id: string;
  applicant_name: string;
  email: string;
  account_type: string;
  status: string;
  current_step: string;
  completion_percentage: number;
  risk_status: string;
  risk_reason: string | null;
  company_name: string;
  company_status: string | null;
  last_activity_at: string;
  missing_documents: string[];
  compliance_check_available: boolean;
  ready_for_approval: boolean;
  compliance_error: string | null;
};

type PendingAction = {
  row: OnboardingRow;
  action: ReviewAction;
};

const label = (value: string) => value.replace(/_/g, ' ');

const statusStyle = (value: string) => {
  const normalized = value.toLowerCase();
  if (['clear', 'ready', 'approved', 'active'].includes(normalized)) {
    return { backgroundColor: '#DCFCE7', borderColor: '#86EFAC', color: '#166534' };
  }
  if (['rejected', 'on_hold', 'confirmed_fraud'].includes(normalized)) {
    return { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', color: '#991B1B' };
  }
  return { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', color: '#92400E' };
};

export default function OnboardingReviewQueue({ onReviewed }: { onReviewed?: () => void }) {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('Platform Owner authentication is required.');
        return;
      }

      const response = await fetch('/api/super-admin/onboarding', {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        rows?: OnboardingRow[];
      };

      if (!response.ok) {
        setError(payload.error ?? `Unable to load onboarding queue (${response.status}).`);
        return;
      }

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const executeAction = async (row: OnboardingRow, action: ReviewAction, notes: string) => {
    setBusyId(row.id);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('Platform Owner authentication is required.');
        return;
      }

      const response = await fetch(`/api/super-admin/onboarding/${row.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, notes: notes || undefined }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? `Onboarding review failed (${response.status}).`);
        return;
      }

      await loadQueue();
      onReviewed?.();
    } finally {
      setBusyId(null);
    }
  };

  const openAction = (row: OnboardingRow, action: ReviewAction) => {
    if (action === 'approve' && !row.ready_for_approval) {
      setError('This onboarding is not ready for approval. Resolve the listed compliance or risk blockers first.');
      return;
    }
    setPendingAction({ row, action });
  };

  const pendingLabel = pendingAction?.action === 'approve'
    ? 'Approve onboarding'
    : pendingAction?.action === 'request_changes'
      ? 'Request changes'
      : 'Reject onboarding';

  return (
    <section
      style={{
        marginBottom: '14px',
        border: '1px solid #D9E1EA',
        borderRadius: '4px',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px',
          borderBottom: '1px solid #D9E1EA',
          backgroundColor: '#F4F6F8',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0B2F6B' }}>
            Onboarding approval queue
          </div>
          <div style={{ marginTop: '2px', fontSize: '11px', color: '#64748B' }}>
            Platform Owner review for submitted or remediation onboarding. Approval remains server-authoritative and compliance-gated.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadQueue()}
          disabled={loading}
          style={{
            height: '32px',
            padding: '0 10px',
            border: '1px solid #1D57D8',
            borderRadius: '4px',
            backgroundColor: '#1D57D8',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 800,
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh queue'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            margin: '10px 12px 0',
            padding: '8px 10px',
            border: '1px solid #FCA5A5',
            borderRadius: '4px',
            backgroundColor: '#FEF2F2',
            color: '#991B1B',
            fontSize: '11px',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '14px', fontSize: '12px', color: '#64748B' }}>Loading onboarding review queue…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '14px', fontSize: '12px', color: '#64748B' }}>No onboarding applications are awaiting Platform review.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#FFFFFF', color: '#0B2F6B', textAlign: 'left' }}>
                {['Applicant', 'Company', 'Account type', 'Onboarding', 'Compliance', 'Risk', 'Actions'].map((heading) => (
                  <th key={heading} style={{ padding: '8px 10px', borderBottom: '1px solid #D9E1EA', fontSize: '10px', textTransform: 'uppercase' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = busyId === row.id;
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }}>
                    <td style={{ padding: '9px 10px' }}>
                      <div style={{ fontWeight: 800, color: '#1A1F2B' }}>{row.applicant_name}</div>
                      <div style={{ color: '#64748B', marginTop: '2px' }}>{row.email || '—'}</div>
                    </td>
                    <td style={{ padding: '9px 10px', color: '#1A1F2B' }}>
                      <div style={{ fontWeight: 700 }}>{row.company_name}</div>
                      <div style={{ color: '#64748B', marginTop: '2px' }}>{row.company_status ? label(row.company_status) : '—'}</div>
                    </td>
                    <td style={{ padding: '9px 10px', color: '#1A1F2B', textTransform: 'capitalize' }}>{label(row.account_type)}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ ...statusStyle(row.status), display: 'inline-block', borderWidth: '1px', borderStyle: 'solid', borderRadius: '999px', padding: '2px 7px', fontWeight: 800 }}>
                        {label(row.status)}
                      </span>
                      <div style={{ color: '#64748B', marginTop: '4px' }}>{label(row.current_step || '—')}</div>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {row.ready_for_approval ? (
                        <span style={{ ...statusStyle('ready'), display: 'inline-block', borderWidth: '1px', borderStyle: 'solid', borderRadius: '999px', padding: '2px 7px', fontWeight: 800 }}>
                          Ready for approval
                        </span>
                      ) : (
                        <>
                          <span style={{ ...statusStyle('pending'), display: 'inline-block', borderWidth: '1px', borderStyle: 'solid', borderRadius: '999px', padding: '2px 7px', fontWeight: 800 }}>
                            Blocked
                          </span>
                          <div style={{ color: '#991B1B', marginTop: '4px', maxWidth: '240px' }}>
                            {!row.compliance_check_available
                              ? row.compliance_error ?? 'Compliance check unavailable.'
                              : row.missing_documents.length
                                ? `Missing: ${row.missing_documents.map(label).join(', ')}`
                                : 'Compliance or risk review is not clear.'}
                          </div>
                        </>
                      )}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ ...statusStyle(row.risk_status), display: 'inline-block', borderWidth: '1px', borderStyle: 'solid', borderRadius: '999px', padding: '2px 7px', fontWeight: 800 }}>
                        {label(row.risk_status)}
                      </span>
                      {row.risk_reason && <div style={{ color: '#991B1B', marginTop: '4px', maxWidth: '220px' }}>{row.risk_reason}</div>}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '118px' }}>
                        <button
                          type="button"
                          disabled={busy || !row.ready_for_approval}
                          onClick={() => openAction(row, 'approve')}
                          title={row.ready_for_approval ? 'Approve through the canonical atomic onboarding review' : 'Resolve compliance/risk blockers first'}
                          style={{ fontSize: '10px', fontWeight: 800 }}
                        >
                          Approve onboarding
                        </button>
                        <button type="button" disabled={busy} onClick={() => openAction(row, 'request_changes')} style={{ fontSize: '10px' }}>
                          Request changes
                        </button>
                        <button type="button" disabled={busy} onClick={() => openAction(row, 'reject')} style={{ fontSize: '10px' }}>
                          Reject onboarding
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ActionConfirmModal
        open={pendingAction !== null}
        title={pendingLabel}
        description={
          pendingAction ? (
            <>
              {pendingAction.action === 'approve'
                ? 'Approve the canonical onboarding for '
                : pendingAction.action === 'request_changes'
                  ? 'Return the canonical onboarding for changes for '
                  : 'Reject the canonical onboarding for '}
              <strong>{pendingAction.row.applicant_name}</strong> ({pendingAction.row.company_name}).
            </>
          ) : null
        }
        confirmLabel={pendingLabel}
        danger={pendingAction?.action === 'reject'}
        reasonRequired={pendingAction?.action !== 'approve'}
        reasonLabel={pendingAction?.action === 'approve' ? 'Review note (optional)' : 'Review reason'}
        reasonPlaceholder={pendingAction?.action === 'approve' ? 'Optional Platform Owner review note…' : 'Explain the required changes or rejection reason…'}
        submitting={busyId !== null}
        onCancel={() => setPendingAction(null)}
        onConfirm={(reason) => {
          if (!pendingAction) return;
          const action = pendingAction;
          setPendingAction(null);
          void executeAction(action.row, action.action, reason);
        }}
      />
    </section>
  );
}
