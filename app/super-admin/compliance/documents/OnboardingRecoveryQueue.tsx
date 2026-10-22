'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  loaded: number;
  recovery_required_on_page: number;
  stale_over_7_days_on_page: number;
  close_to_complete_on_page: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12_000);
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('Platform Owner authentication is required.');
        return;
      }
      const response = await fetch(`/api/super-admin/onboarding/recovery?page=${page}&limit=50`, {
        headers: { Authorization: auth },
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        rows?: RecoveryRow[];
        summary?: Summary;
        pagination?: Pagination;
      };
      if (!response.ok) {
        setError(payload.error ?? `Unable to load onboarding recovery queue (${response.status}).`);
        return;
      }
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setSummary(payload.summary ?? null);
      setPagination(payload.pagination ?? null);
    } catch (cause) {
      if (controller.signal.aborted && !timedOut) return;
      setError(timedOut
        ? 'Onboarding recovery queue timed out. No stale queue is being shown.'
        : cause instanceof Error
          ? cause.message
          : 'Unable to load onboarding recovery queue.');
    } finally {
      window.clearTimeout(timeout);
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        if (!controller.signal.aborted || timedOut) setLoading(false);
      }
    }
  }, [page]);

  useEffect(() => {
    void load();
    return () => requestControllerRef.current?.abort();
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
          <div style={{ marginTop: 2, fontSize: 14, color: '#667085' }}>
            Existing applicants keep their saved data and documents. Canonical progress shows only what is still required.
          </div>
          {summary && (
            <div style={{ marginTop: 6, fontSize: 14, color: '#475467' }}>
              {summary.total} eligible total · this page: {summary.recovery_required_on_page} require completion · {summary.stale_over_7_days_on_page} inactive over 7 days · {summary.close_to_complete_on_page} at least 70% complete
            </div>
          )}
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ height: 32, padding: '0 10px', border: '1px solid #1D57D8', borderRadius: 4, background: '#1D57D8', color: '#FFF', fontSize: 14, fontWeight: 800 }}>
          {loading ? 'Refreshing…' : 'Refresh queue'}
        </button>
      </div>

      {error && <div role="alert" style={{ margin: '10px 12px 0', padding: '8px 10px', border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEF2F2', color: '#991B1B', fontSize: 14 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 14, fontSize: 12, color: '#667085' }}>Loading onboarding recovery queue…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 14, fontSize: 12, color: '#667085' }}>No incomplete onboarding applications were found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ color: '#0B2F6B', textAlign: 'left' }}>
                {['Applicant', 'Role / status', 'Progress', 'Still required', 'Last activity', 'Action'].map((heading) => (
                  <th key={heading} style={{ padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontSize: 14, textTransform: 'uppercase' }}>{heading}</th>
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
                        style={{ fontSize: 14, fontWeight: 800 }}
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

      {pagination && pagination.totalPages > 1 ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 12, borderTop: '1px solid #E5E7EB', fontSize: 14, color: '#475467' }}>
          <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} eligible applications</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={!pagination.hasPrevPage || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <button type="button" disabled={!pagination.hasNextPage || loading} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        </div>
      ) : null}

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
