'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from './DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type NotificationRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown> | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  created_at: string;
  recipient_user_id?: string | null;
};

type TabId = 'all' | 'pending' | 'attention';
const tabLabels: Array<{ id: TabId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending delivery' },
  { id: 'attention', label: 'Attention' },
];

function formatTitle(eventType: string) {
  return eventType.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatPreview(notification: NotificationRow) {
  const payload = notification.payload ?? {};
  const pickup = typeof payload.pickup_location === 'string' ? payload.pickup_location : null;
  const delivery = typeof payload.delivery_location === 'string' ? payload.delivery_location : null;
  const ref = typeof payload.job_ref === 'string' ? payload.job_ref : notification.entity_id.slice(0, 8).toUpperCase();
  if (pickup || delivery) return `${ref}: ${pickup ?? 'Pickup'} → ${delivery ?? 'Delivery'}`;
  return `Operational update linked to ${notification.entity_type.replace(/_/g, ' ')}.`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DriverNotificationRegister({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<NotificationRow[]>([]);
  const [tab, setTab] = useState<TabId>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.companyId || !user.id) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('notification_events')
      .select('id, event_type, entity_type, entity_id, payload, status, created_at, recipient_user_id')
      .eq('company_id', user.companyId)
      .or(`recipient_user_id.is.null,recipient_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (queryError) {
      setError('Notifications are temporarily unavailable.');
      setMessages([]);
    } else {
      setMessages((data ?? []) as NotificationRow[]);
    }
    setLoading(false);
  }, [user?.companyId, user?.id]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  const visibleMessages = useMemo(() => {
    if (tab === 'pending') return messages.filter((message) => message.status === 'pending');
    if (tab === 'attention') return messages.filter((message) => message.status === 'failed' || message.status === 'skipped');
    return messages;
  }, [messages, tab]);

  const counts = useMemo(() => ({
    all: messages.length,
    pending: messages.filter((message) => message.status === 'pending').length,
    attention: messages.filter((message) => message.status === 'failed' || message.status === 'skipped').length,
  }), [messages]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        driverName={title}
        subtitle={subtitle}
        headerActions={<ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        <div className="driver-board-layout driver-messages-board">
          <aside className="driver-filter-rail" aria-label="Notification filters">
            <div className="driver-filter-rail__header">Notification Register</div>
            <div className="driver-filter-rail__body">
              {tabLabels.map((item) => (
                <button key={item.id} type="button" className="driver-account-link" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>
                  <span><strong>{item.label}</strong><small>Backend delivery state</small></span><span>{counts[item.id]}</span>
                </button>
              ))}
              <ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
            </div>
          </aside>
          <main className="driver-board-main">
            <div className="driver-tab-strip" role="tablist" aria-label="Notification delivery states">
              {tabLabels.map((item) => <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label} <span>{counts[item.id]}</span></button>)}
            </div>
            <div className="driver-board-summary"><span>{visibleMessages.length} notification{visibleMessages.length === 1 ? '' : 's'} · delivery status, not read-state</span></div>
            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading notifications…" /></div>
            ) : visibleMessages.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title="No notifications match this filter" /></div>
            ) : (
              <div className="driver-load-list">
                {visibleMessages.map((message) => (
                  <article key={message.id} className="driver-load-row" data-state={message.status}>
                    <div className="driver-load-row__top">
                      <div className="driver-load-cell"><span className="driver-cell-label">Event</span><strong className="driver-cell-primary">{formatTitle(message.event_type)}</strong><span className="driver-cell-secondary">{message.entity_type.replace(/_/g, ' ')}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Details</span><strong className="driver-cell-primary">{formatPreview(message)}</strong><span className="driver-cell-secondary">Entity #{message.entity_id.slice(0, 8).toUpperCase()}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Created</span><strong className="driver-cell-primary">{formatDateTime(message.created_at)}</strong><span className="driver-cell-secondary">Operational event</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Delivery</span><strong className="driver-cell-primary">{message.status}</strong><span className="driver-cell-secondary"><StatusBadge value={message.status} tone={message.status === 'sent' ? 'green' : message.status === 'pending' ? 'orange' : 'red'} /></span></div>
                    </div>
                    <div className="driver-load-row__meta"><span>Notification #{message.id.slice(0, 8).toUpperCase()}</span><StatusBadge value={message.status} tone={message.status === 'sent' ? 'green' : message.status === 'pending' ? 'orange' : 'red'} /></div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
