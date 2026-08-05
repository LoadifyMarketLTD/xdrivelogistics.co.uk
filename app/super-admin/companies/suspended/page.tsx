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

type PendingReinstate = { companyId: string; companyName: string } | null;

// ---------------------------------------------------------------------------
// Confirmation modal
// ---------------------------------------------------------------------------

function ReinstateModal({
  pending,
  onConfirm,
  onCancel,
  submitting,
}: {
  pending: PendingReinstate;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState('');
  if (!pending) return null;

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
          🔓 Reinstate company
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.84rem', color: THEME.muted }}>
          You are about to <strong style={{ color: THEME.green }}>reinstate</strong>{' '}
          <strong style={{ color: THEME.text }}>{pending.companyName}</strong> and restore platform access.
          This action is recorded in the audit log.
        </p>

        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', fontWeight: 600, color: THEME.muted }}>
          Reason for reinstatement (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Explain why this company is being reinstated…"
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: '#0b1220', border: `1px solid #334155`,
            borderRadius: '8px', padding: '0.55rem 0.75rem',
            color: THEME.text, fontSize: '0.82rem', resize: 'vertical',
            outline: 'none',
          }}
        />

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
            disabled={submitting}
            style={{
              padding: '0.45rem 0.9rem', borderRadius: '7px', border: 'none',
              backgroundColor: THEME.green,
              color: '#fff', fontWeight: 700, fontSize: '0.8rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? '…' : 'Confirm Reinstatement'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page content
// ---------------------------------------------------------------------------

function SuspendedContent() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReinstate>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchSuspended = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); setLoading(false); return; }

      const res = await fetch('/api/super-admin/companies?status=suspended', {
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

  useEffect(() => { fetchSuspended(); }, [fetchSuspended]);

  const handleConfirm = async (reason: string) => {
    if (!pending) return;
    setSubmitting(true);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setActionMessage('No active session.'); setPending(null); setSubmitting(false); return; }

      const body: Record<string, string> = { action: 'reinstate' };
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
        setActionMessage('Company reinstated ✅ — status set to active.');
        await fetchSuspended();
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
      <ReinstateModal
        pending={pending}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
        submitting={submitting}
      />

      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>🚫</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Suspended Companies</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Companies
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Suspended companies. Use Reinstate to restore platform access. No data is deleted.
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
              No suspended companies.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                  {['Company name', 'Reg. number', 'Email', 'Type', 'Created', 'Action'].map((h) => (
                    <th key={h} style={{ padding: '0.75rem 0.9rem', textAlign: 'left', color: THEME.muted, fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((co) => (
                  <tr key={co.id} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.text, fontWeight: 600 }}>
                      {co.name}
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.66rem', color: THEME.red, backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid ${THEME.red}`, borderRadius: '4px', padding: '0.1rem 0.35rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        Suspended
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{co.company_number ?? '—'}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{co.email ?? '—'}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{co.company_type ?? 'standard'}</td>
                    <td style={{ padding: '0.75rem 0.9rem', color: THEME.muted }}>{fmt(co.created_at)}</td>
                    <td style={{ padding: '0.75rem 0.9rem' }}>
                      <button
                        onClick={() => { setActionMessage(null); setPending({ companyId: co.id, companyName: co.name }); }}
                        disabled={submitting && pending?.companyId === co.id}
                        style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: `1px solid ${THEME.green}`, backgroundColor: 'transparent', color: THEME.green, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' }}
                      >
                        Reinstate
                      </button>
                    </td>
                  </tr>
                ))}
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
      <SuspendedContent />
    </ProtectedRoute>
  );
}
