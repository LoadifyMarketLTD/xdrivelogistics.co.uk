'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '../_components/SuperAdminLiveTablePage';
import { ActionConfirmModal } from '../_components/ActionConfirmModal';
import {
  createNotificationColumns,
  notificationsTableProps,
  performNotificationRetry,
  type NotificationRow,
  type RetryFeedback,
} from './_lib/notificationsPage';

const X = { navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B' } as const;
const controlStyle = { height: '32px', background: X.white, color: X.charcoal, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '0 8px', fontSize: '12px', outlineColor: X.blue } as const;

export default function Page() {
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, RetryFeedback | undefined>>({});
  const [retryTargetId, setRetryTargetId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [previewReadOnly, setPreviewReadOnly] = useState(false);

  useEffect(() => {
    setPreviewReadOnly(window.location.hostname.startsWith('deploy-preview-'));
  }, []);

  const executeRetry = useCallback(async (notificationId: string, reason: string) => {
    if (pendingById[notificationId] || previewReadOnly) return;
    setPendingById((current) => ({ ...current, [notificationId]: true }));
    setFeedbackById((current) => ({ ...current, [notificationId]: undefined }));
    const feedback = await performNotificationRetry({
      notificationId,
      reason,
      onSuccess: () => setRefreshKey((value) => value + 1),
    });
    setPendingById((current) => { const next = { ...current }; delete next[notificationId]; return next; });
    setFeedbackById((current) => ({ ...current, [notificationId]: feedback }));
  }, [pendingById, previewReadOnly]);

  const beginRetry = useCallback((notificationId: string) => {
    if (pendingById[notificationId] || previewReadOnly) return;
    setRetryTargetId(notificationId);
  }, [pendingById, previewReadOnly]);

  const columns = useMemo(
    () => createNotificationColumns({ pendingById, feedbackById, onRetry: beginRetry, previewReadOnly }),
    [pendingById, feedbackById, beginRetry, previewReadOnly],
  );
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

  return <div style={{ background: X.light, minHeight: '100vh' }}>
    {retryTargetId && !previewReadOnly && (
      <ActionConfirmModal
        open
        title="Retry notification delivery"
        description={<>Queue notification <strong>{retryTargetId}</strong> for another delivery attempt. This Platform Owner action is audited.</>}
        confirmLabel="Queue audited retry"
        reasonRequired
        reasonLabel="Retry reason"
        reasonPlaceholder="Explain why this notification should be retried…"
        submitting={pendingById[retryTargetId] === true}
        onCancel={() => setRetryTargetId(null)}
        onConfirm={(reason) => {
          const notificationId = retryTargetId;
          setRetryTargetId(null);
          void executeRetry(notificationId, reason);
        }}
      />
    )}
    <div style={{ padding: '12px 12px 0' }}>
      <div style={{ minHeight: '40px', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '4px 8px', display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(3, minmax(130px, 1fr)) auto', gap: '8px', alignItems: 'center' }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, message, event type or entity…" aria-label="Search notifications" style={{ ...controlStyle, width: '100%' }} />
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Notification category" style={controlStyle}><option value="all">All categories</option><option value="onboarding">Onboarding</option><option value="marketplace">Marketplace</option><option value="jobs">Jobs</option><option value="fleet">Fleet</option><option value="finance">Finance</option><option value="compliance">Compliance</option><option value="security">Security</option><option value="platform">Platform</option></select>
        <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Notification severity" style={controlStyle}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option><option value="success">Success</option></select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Notification delivery status" style={controlStyle}><option value="all">All delivery states</option><option value="pending">Pending</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="skipped">Skipped</option></select>
        <button type="button" onClick={clearFilters} style={{ ...controlStyle, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', color: X.navy }}>Clear filters</button>
      </div>
      {previewReadOnly ? <div style={{ marginTop: '8px', borderLeft: `4px solid ${X.orange}`, background: '#fffaf0', padding: '7px 9px', color: '#806b43', fontSize: '10px' }}>Deploy Preview safety: notification records are live read-only data. Retry is displayed for parity but disabled in #431.</div> : null}
    </div>
    <SuperAdminLiveTablePage<NotificationRow> key={endpoint} {...notificationsTableProps} endpoint={endpoint} refreshKey={refreshKey} columns={columns} />
  </div>;
}
