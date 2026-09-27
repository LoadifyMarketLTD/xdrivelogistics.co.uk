'use client';

import { useCallback, useEffect, useState } from 'react';

import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type RecoveryRow = {
  id: string;
  email: string;
  applicant_name: string;
  account_type: string;
  status: string;
  current_step: string;
  stored_completion_percentage: number;
  canonical_completion_percentage: number;
  last_activity_at: string | null;
  inactive_days: number | null;
  missing_fields: Array<{ key: string; label: string }>;
  missing_documents: Array<{ type: string; label: string }>;
  blocking_reasons: string[];
  recovery_required: boolean;
  last_recovery_event_type: string | null;
  last_recovery_event_at: string | null;
  reminder_eligible: boolean;
};

type Summary = {
  total: number;
  recovery_required: number;
  stale_over_7_days: number;
  close_to_complete: number;
};

const label = (value: string) => value.replace(/_/g, ' ');

export default function OnboardingRecoveryQueue() {
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRow, setPendingRow] = useState<RecoveryRow | null>(null);
  const [pendingReminder, setPendingReminder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('Platform Owner authentication is required.');
        return;
      }
      const response = await fetch('/api/super-admin/onboarding/recovery', {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        rows?: RecoveryRow[];
        summary?: Summary;
      };
      if (!response.ok) {
        setError(payload.error ?? `Unable to load onboarding recovery queue (${response.status}).`);
        return;
      }
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setSummary(payload.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sendRecovery = async (row: RecoveryRow, reason: string, reminder: boolean) => {
    setBusyId(row.id);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('Platform Owner authentication is required.');
        return;
      }
      const response = await fetch(`/api/super-admin/onboarding/${row.id}/request-completion`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, reminder }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? `Unable to queue completion request (${response.status}).`);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section style={{ marginBottom: 14, border: '1px solid #E5E7EB', borderRadius: 4, background: '#FFF', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, borderBottom: '1px solid #E5E7EB', background: '#F4F6F8' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0B2F6B' }}>Onboarding recovery queue</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#667085' }}>
            Existing applicants keep their saved data and documents. Canonical progress shows only what is still required.
          </div>
          {summary && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#475467' }}>
              {summary.recovery_required} require completion · {summary.stale_over_7_days} inactive over 7 days · {summary.close_to_complete} at least 70% complete
            </div>
          )}
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ height: 32, padding: '0 10px', border: '1px solid #1D57D8', borderRadius: 4, background: '#1D57D8', color: '#FFF', fontSize: 11, fontWeight: 800 }}>
          {loading ? 'Refreshing…' : 'Refresh queue'}
        </button>
      </div>

      {error && <div role="alert" style={{ margin: '10px 12px 0', padding: '8px 10px', border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEF2F2', color: '#991B1B', fontSize: 11 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 14, fontSize: 12, color: '#667085' }}>Loading onboarding recovery queue…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 14, fontSize: 12, color: '#667085' }}>No incomplete onboarding applications were found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: '#0B2F6B', textAlign: 'left' }}>
                {['Applicant', 'Role / status', 'Progress', 'Still required', 'Last activity', 'Action'].map((heading) => (
                  <th key={heading} style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontSize: 10, textTransform: 'uppercase' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = busyId === row.id;
                const requirements = [
                  ...row.missing_fields.map((item) => item.label),
                  ...row.missing_documents.map((item) => item.label),
                ];
                const hasRecoveryRequest = Boolean(row.last_recovery_event_at);
                const reminderLocked = hasRecoveryRequest && !row.reminder_eligible;
                const actionIsReminder = hasRecoveryRequest && row.reminder_eligible;
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }}>
                    <td style={{ padding: '9px 10px' }}>
                      <strong>{row.applicant_name}</strong>
                      <div style={{ color: '#667085', marginTop: 2 }}>{row.email || '—'}</div>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <div style={{ textTransform: 'capitalize' }}>{label(row.account_type)}</div>
                      <div style={{ color: '#667085', marginTop: 2 }}>{label(row.status)} · {label(row.current_step || '—')}</div>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <strong>{row.canonical_completion_percentage}%</strong>
                      {row.stored_completion_percentage !== row.canonical_completion_percentage && (
                        <div style={{ color: '#9A6700', marginTop: 2 }}>Stored: {row.stored_completion_percentage}%</div>
                      )}
                    </td>
                    <td style={{ padding: '9px 10px', maxWidth: 360 }}>
                      {requirements.length > 0 ? requirements.join(', ') : row.blocking_reasons.join(' ') || 'No canonical requirements missing'}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {typeof row.inactive_days === 'number' ? `${row.inactive_days} days ago` : '—'}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <button
                        type="button"
                        disabled={busy || !row.recovery_required || reminderLocked}
                        onClick={() => {
                          setPendingReminder(actionIsReminder);
                          setPendingRow(row);
                        }}
                        style={{ fontSize: 10, fontWeight: 800 }}
                      >
                        {reminderLocked ? 'Reminder available after 7 days' : actionIsReminder ? 'Send reminder' : 'Send completion request'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ActionConfirmModal
        open={pendingRow !== null}
        title={pendingReminder ? 'Send onboarding reminder' : 'Send onboarding completion request'}
        description={pendingRow ? <>Email <strong>{pendingRow.applicant_name}</strong> with the exact information and documents still required. Existing progress will be preserved.</> : null}
        confirmLabel={pendingReminder ? 'Queue reminder' : 'Queue completion request'}
        reasonRequired
        reasonLabel="Message to applicant"
        reasonPlaceholder="Explain that XDrive has updated onboarding requirements and their existing progress has been preserved…"
        submitting={busyId !== null}
        onCancel={() => {
          setPendingRow(null);
          setPendingReminder(false);
        }}
        onConfirm={(reason) => {
          if (!pendingRow) return;
          const row = pendingRow;
          const reminder = pendingReminder;
          setPendingRow(null);
          setPendingReminder(false);
          void sendRecovery(row, reason, reminder);
        }}
      />
    </section>
  );
}
