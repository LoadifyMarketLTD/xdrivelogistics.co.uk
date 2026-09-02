'use client';

import { useCallback, useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '../_components/SuperAdminLiveTablePage';
import {
  createNotificationColumns,
  notificationsTableProps,
  performNotificationRetry,
  type NotificationRow,
  type RetryFeedback,
} from './_lib/notificationsPage';

const X = { navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', danger: '#DC2626' } as const;
const controlStyle = { height: '32px', background: X.white, color: X.charcoal, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '0 8px', fontSize: '12px', outlineColor: X.blue } as const;

export default function Page() {
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, RetryFeedback | undefined>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [retryTarget, setRetryTarget] = useState<string | null>(null);
  const [retryReason, setRetryReason] = useState('');

  const openRetry = useCallback((notificationId: string) => {
    if (pendingById[notificationId]) return;
    setRetryTarget(notificationId);
    setRetryReason('');
  }, [pendingById]);

  const closeRetry = useCallback(() => {
    if (retryTarget && pendingById[retryTarget]) return;
    setRetryTarget(null);
    setRetryReason('');
  }, [pendingById, retryTarget]);

  const confirmRetry = useCallback(async () => {
    const notificationId = retryTarget;
    if (!notificationId || pendingById[notificationId]) return;
    if (retryReason.trim().length < 5) {
      setFeedbackById((current) => ({ ...current, [notificationId]: { tone: 'error', message: 'Enter a retry reason of at least 5 characters.' } }));
      return;
    }

    setPendingById((current) => ({ ...current, [notificationId]: true }));
    setFeedbackById((current) => ({ ...current, [notificationId]: undefined }));
    const feedback = await performNotificationRetry({
      notificationId,
      reason: retryReason,
      onSuccess: () => setRefreshKey((value) => value + 1),
    });
    setPendingById((current) => { const next = { ...current }; delete next[notificationId]; return next; });
    setFeedbackById((current) => ({ ...current, [notificationId]: feedback }));
    if (feedback.tone === 'success') {
      setRetryTarget(null);
      setRetryReason('');
    }
  }, [pendingById, retryReason, retryTarget]);

  const columns = useMemo(() => createNotificationColumns({ pendingById, feedbackById, onRetry: openRetry }), [pendingById, feedbackById, openRetry]);
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (status !== 'all') params.set('status', status);
    if (category !== 'all') params.set('category', category);
    if (severity !== 'all') params.set('severity', severity);
    const query = params.toString();
    return `/api/super-admin/notifications${query ? `?${query}` : ''}`;
  }, [search, status, category, severity]);

  const clearFilters = () => { setSearch(''); setStatus('all'); setCategory('all'); setSeverity('all'); };
  const retryPending = retryTarget ? pendingById[retryTarget] === true : false;

  return <div style={{ background: X.light, minHeight: '100vh' }}>
    <div style={{ padding: '12px 12px 0' }}>
      <div style={{ minHeight: '40px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '4px 8px', display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(3, minmax(130px, 1fr)) auto', gap: '8px', alignItems: 'center' }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, message, event type or entity…" aria-label="Search notifications" style={{ ...controlStyle, width: '100%' }} />
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Notification category" style={controlStyle}><option value="all">All categories</option><option value="onboarding">Onboarding</option><option value="marketplace">Marketplace</option><option value="jobs">Jobs</option><option value="fleet">Fleet</option><option value="finance">Finance</option><option value="compliance">Compliance</option><option value="security">Security</option><option value="platform">Platform</option></select>
        <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Notification severity" style={controlStyle}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option><option value="success">Success</option></select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Notification delivery status" style={controlStyle}><option value="all">All delivery states</option><option value="pending">Pending</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="skipped">Skipped</option></select>
        <button type="button" onClick={clearFilters} style={{ ...controlStyle, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', color: X.navy }}>Clear filters</button>
      </div>
    </div>
    <SuperAdminLiveTablePage<NotificationRow> key={endpoint} {...notificationsTableProps} endpoint={endpoint} refreshKey={refreshKey} columns={columns} />

    {retryTarget && <div role="dialog" aria-modal="true" aria-labelledby="retry-notification-title" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(7,27,60,0.42)', display: 'grid', placeItems: 'center', padding: '20px' }}>
      <div style={{ width: 'min(520px, 100%)', background: X.white, border: `1px solid ${X.border}`, borderRadius: '8px', boxShadow: '0 22px 60px rgba(7,27,60,.24)', padding: '20px' }}>
        <div id="retry-notification-title" style={{ color: X.navy, fontSize: '18px', fontWeight: 800 }}>Retry notification</div>
        <p style={{ margin: '8px 0 14px', color: X.muted, fontSize: '13px', lineHeight: 1.5 }}>This will release any stale queue lease and requeue the event. The original attempt history is preserved and your reason is written to the Platform Owner audit log.</p>
        <label htmlFor="retry-reason" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: X.charcoal, marginBottom: '6px' }}>Reason</label>
        <textarea id="retry-reason" value={retryReason} onChange={(event) => setRetryReason(event.target.value)} maxLength={2000} rows={4} placeholder="Explain why this failed or skipped event should be retried…" style={{ width: '100%', resize: 'vertical', border: `1px solid ${X.border}`, borderRadius: '6px', padding: '10px', font: 'inherit', fontSize: '13px', color: X.charcoal, outlineColor: X.blue }} />
        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={closeRetry} disabled={retryPending} style={{ ...controlStyle, cursor: retryPending ? 'not-allowed' : 'pointer', fontWeight: 700 }}>Cancel</button>
          <button type="button" onClick={() => { void confirmRetry(); }} disabled={retryPending || retryReason.trim().length < 5} style={{ ...controlStyle, cursor: retryPending || retryReason.trim().length < 5 ? 'not-allowed' : 'pointer', fontWeight: 800, borderColor: retryPending || retryReason.trim().length < 5 ? X.border : X.blue, background: retryPending || retryReason.trim().length < 5 ? X.light : X.blue, color: retryPending || retryReason.trim().length < 5 ? X.muted : X.white }}>{retryPending ? 'Queuing…' : 'Queue retry'}</button>
        </div>
      </div>
    </div>}
  </div>;
}
