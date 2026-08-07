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

const controlStyle = {
  background: '#0f172a',
  color: '#f8fafc',
  border: '1px solid #475569',
  borderRadius: '7px',
  padding: '0.5rem 0.65rem',
  fontSize: '0.76rem',
} as const;

export default function Page() {
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, RetryFeedback | undefined>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');

  const handleRetry = useCallback(async (notificationId: string) => {
    if (pendingById[notificationId]) return;
    setPendingById((current) => ({ ...current, [notificationId]: true }));
    setFeedbackById((current) => ({ ...current, [notificationId]: undefined }));

    const feedback = await performNotificationRetry({
      notificationId,
      onSuccess: () => setRefreshKey((value) => value + 1),
    });

    setPendingById((current) => {
      const next = { ...current };
      delete next[notificationId];
      return next;
    });
    setFeedbackById((current) => ({ ...current, [notificationId]: feedback }));
  }, [pendingById]);

  const columns = useMemo(
    () => createNotificationColumns({ pendingById, feedbackById, onRetry: handleRetry }),
    [pendingById, feedbackById, handleRetry],
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

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh' }}>
      <div style={{ padding: '1.25rem 1.5rem 0' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '0.8rem', display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(3, minmax(130px, 1fr)) auto', gap: '0.55rem', alignItems: 'center' }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, message, event type or entity…"
            aria-label="Search notifications"
            style={{ ...controlStyle, width: '100%' }}
          />
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Notification category" style={controlStyle}>
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
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Notification severity" style={controlStyle}>
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Notification delivery status" style={controlStyle}>
            <option value="all">All delivery states</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
          <button type="button" onClick={clearFilters} style={{ ...controlStyle, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
            Clear filters
          </button>
        </div>
      </div>

      <SuperAdminLiveTablePage<NotificationRow>
        key={endpoint}
        {...notificationsTableProps}
        endpoint={endpoint}
        refreshKey={refreshKey}
        columns={columns}
      />
    </div>
  );
}
