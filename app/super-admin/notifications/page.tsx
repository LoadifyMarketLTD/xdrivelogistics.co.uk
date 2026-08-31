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
    setPendingById((current) => {
      const next = { ...current };
      delete next[notificationId];
      return next;
    });
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

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setCategory('all');
    setSeverity('all');
  };

  const toolbar = <>
    <section className="sa-filter-bar" aria-label="Notification filters">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search title, message, event type or entity…"
        aria-label="Search notifications"
        className="sa-filter-input"
      />
      <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Notification category" className="sa-filter-select">
        <option value="all">All categories</option>
        <option value="onboarding">Onboarding</option>
        <option value="marketplace">Marketplace</option>
        <option value="jobs">Jobs</option>
        <option value="fleet">Fleet</option>
        <option value="finance">Finance</option>
        <option value="compliance">Compliance</option>
        <option value="security">Security</option>
        <option value="platform">Platform</option>
      </select>
      <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Notification severity" className="sa-filter-select">
        <option value="all">All severities</option>
        <option value="critical">Critical</option>
        <option value="warning">Warning</option>
        <option value="info">Info</option>
        <option value="success">Success</option>
      </select>
      <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Notification delivery status" className="sa-filter-select">
        <option value="all">All delivery states</option>
        <option value="pending">Pending</option>
        <option value="sent">Sent</option>
        <option value="failed">Failed</option>
        <option value="skipped">Skipped</option>
      </select>
      <button type="button" onClick={clearFilters} className="sa-secondary-button">Clear filters</button>
    </section>
    {previewReadOnly ? <div className="sa-state-block" data-tone="warning">Deploy Preview safety: notification records are live read-only data. Retry is displayed for parity but disabled in #431.</div> : null}
  </>;

  return <>
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
    <SuperAdminLiveTablePage<NotificationRow>
      key={endpoint}
      {...notificationsTableProps}
      endpoint={endpoint}
      refreshKey={refreshKey}
      columns={columns}
      toolbar={toolbar}
    />
  </>;
}
