'use client';

import { useEffect, useState, useCallback } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

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

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  email: string | null;
  status: string;
  company_type: string | null;
  created_at: string;
};

/** Pending action waiting for confirmation — null means no modal is open. */
type PendingAction = {
  companyId: string;
  companyName: string;
  action: 'approve' | 'reject';
} | null;

// ---------------------------------------------------------------------------
// Confirmation modal
// ---------------------------------------------------------------------------

function ConfirmModal({
  pending,
  onConfirm,
  onCancel,
  submitting,
}: {
  pending: PendingAction;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState('');
  if (!pending) return null;

  const isReject = pending.action === 'reject';
  const isDisabled = submitting || (isReject && reason.trim().length < 5);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          backgroundColor: '#1e293b', border: `1px solid #334155`,
          borderRadius: '14px', padding: '1.5rem', width: '100%', maxWidth: '420px',
        }}
      >
        <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', fontWeight: 700, color: THEME.text }}>
          {isReject ? '❌ Reject company' : '✅ Approve company'}
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.84rem', color: THEME.muted }}>
          {isReject
            ? <>You are about to <strong style={{ color: THEME.red }}>reject</strong> <strong style={{ color: THEME.text }}>{pending.companyName}</strong>. This action is recorded in the audit log.</>
            : <>You are about to <strong style={{ color: THEME.green }}>approve</strong> <strong style={{ color: THEME.text }}>{pending.companyName}</strong> and grant platform access.</>
          }
        </p>

        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', fontWeight: 600, color: THEME.muted }}>
          {isReject ? 'Reason for rejection (required)' : 'Reason / notes (optional)'}
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={isReject ? 'Explain why this application is being rejected…' : 'Approval notes (optional)…'}
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: '#0b1220', border: `1px solid #334155`,
            borderRadius: '8px', padding: '0.55rem 0.75rem',
            color: THEME.text, fontSize: '0.82rem', resize: 'vertical',
            outline: 'none',
          }}
        />
        {isReject && reason.trim().length > 0 && reason.trim().length < 5 && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: THEME.red }}>
            Reason must be at least 5 characters.
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: '0.45rem 0.9rem', borderRadius: '7px',
              border: `1px solid #334155`, backgroundColor: 'transparent',
              color: THEME.muted, fontSize: '0.8rem', cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={isDisabled}
            style={{
              padding: '0.45rem 0.9rem', borderRadius: '7px', border: 'none',
              backgroundColor: isReject ? THEME.red : THEME.green,
              color: '#fff', fontWeight: 700, fontSize: '0.8rem',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.6 : 1,
            }}
          >
            {submitting ? '…' : isReject ? 'Confirm Rejection' : 'Confirm Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page content
// ---------------------------------------------------------------------------

function ApprovalsContent() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); setLoading(false); return; }

      const res = await fetch('/api/super-admin/companies?status=pending', {
        headers: { Authorization: auth },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const data = await res.json() as { companies: Company[] };
      setCompanies(data.companies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const openModal = (co: Company, action: 'approve' | 'reject') => {
    setActionMessage(null);
    setPending({ companyId: co.id, companyName: co.name, action });
  };

  const handleConfirm = async (reason: string) => {
    if (!pending) return;
    setSubmitting(true);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setActionMessage('No active session.'); setPending(null); setSubmitting(false); return; }

      const body: Record<string, string> = { action: pending.action };
      if (reason) body.reason = reason;

      const res = await fetch(`/api/super-admin/companies/${pending.companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage((payload as { error?: string }).error ?? `HTTP ${res.status}`);
      } else {
        setActionMessage(`Company ${pending.action === 'approve' ? 'approved ✅' : 'rejected ❌'} successfully.`);
        await fetchPending();
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setPending(null);
      setSubmitting(false);
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <>
      <ConfirmModal
        pending={pending}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
        submitting={submitting}
      />

      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>✅</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Approvals Queue</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Companies
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Company onboarding applications waiting for platform review.
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

        <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>Loading…</div>
          ) : companies.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>
              No companies pending approval.
              <br />
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              Companies with status <code style={{ backgroundColor: '#0b1220', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>pending</code> (legacy: <code style={{ backgroundColor: '#0b1220', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>pending_approval</code>) will appear here.
              </span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                  {['Company name', 'Reg. number', 'Email', 'Type', 'Applied', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '0.75rem 0.9rem', textAlign: 'left', color: THEME.muted, fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((co) => {
                  const isThisActing = submitting && pending?.companyId === co.id;
                  return (
                    <tr key={co.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                      <td style={{ padding: '0.75rem 0.9rem', color: THEME.text, fontWeight: 600 }}>{co.name}</td>
                      <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{co.company_number ?? '—'}</td>
                      <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{co.email ?? '—'}</td>
                      <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{co.company_type ?? 'standard'}</td>
                      <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{fmt(co.created_at)}</td>
                      <td style={{ padding: '0.75rem 0.9rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => openModal(co, 'approve')}
                            disabled={isThisActing}
                            style={{ padding: '0.3rem 0.65rem', borderRadius: '6px', border: 'none', backgroundColor: THEME.green, color: '#fff', fontWeight: 700, fontSize: '0.72rem', cursor: isThisActing ? 'not-allowed' : 'pointer', opacity: isThisActing ? 0.6 : 1 }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openModal(co, 'reject')}
                            disabled={isThisActing}
                            style={{ padding: '0.3rem 0.65rem', borderRadius: '6px', border: `1px solid ${THEME.red}`, backgroundColor: 'transparent', color: THEME.red, fontWeight: 700, fontSize: '0.72rem', cursor: isThisActing ? 'not-allowed' : 'pointer', opacity: isThisActing ? 0.6 : 1 }}
                          >
                            Reject
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
    </>
  );
}

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <ApprovalsContent />
    </ProtectedRoute>
  );
}
