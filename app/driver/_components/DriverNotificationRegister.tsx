'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from './DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  read_at: string | null;
  created_at: string;
};

type TabId = 'all' | 'unread' | 'load_alerts' | 'operational';
const tabLabels: Array<{ id: TabId; label: string; detail: string }> = [
  { id: 'all', label: 'All', detail: 'Recipient-scoped inbox' },
  { id: 'unread', label: 'Unread', detail: 'Needs your attention' },
  { id: 'load_alerts', label: 'Load Alerts', detail: 'Marketplace / nearby / return-journey alerts' },
  { id: 'operational', label: 'Operational', detail: 'Jobs, bids, POD, ETA and finance' },
];

const LOAD_ALERT_TYPES = new Set([
  'load_alert',
  'marketplace_load_alert',
  'nearby_load_alert',
  'return_journey_alert',
  'won_load',
  'bid_accepted',
]);

const OPERATIONAL_TYPES = new Set([
  'job_assigned',
  'bid_accepted',
  'bid_rejected',
  'pod_uploaded',
  'tracking_eta_alert',
  'invoice_dispute',
  'invoice_created',
  ...LOAD_ALERT_TYPES,
]);

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function typeLabel(value: string | null) {
  return value ? value.replace(/_/g, ' ') : 'notification';
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
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('notifications')
      .select('id, title, body, type, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (queryError) {
      setError('Notifications are temporarily unavailable.');
      setMessages([]);
    } else {
      setMessages((data ?? []) as NotificationRow[]);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  const visibleMessages = useMemo(() => {
    if (tab === 'unread') return messages.filter((message) => !message.read_at);
    if (tab === 'load_alerts') return messages.filter((message) => LOAD_ALERT_TYPES.has(String(message.type ?? '')));
    if (tab === 'operational') return messages.filter((message) => OPERATIONAL_TYPES.has(String(message.type ?? '')));
    return messages;
  }, [messages, tab]);

  const counts = useMemo(() => ({
    all: messages.length,
    unread: messages.filter((message) => !message.read_at).length,
    load_alerts: messages.filter((message) => LOAD_ALERT_TYPES.has(String(message.type ?? ''))).length,
    operational: messages.filter((message) => OPERATIONAL_TYPES.has(String(message.type ?? ''))).length,
  }), [messages]);

  const markRead = async (notificationId: string) => {
    if (!user?.id) return;
    setWorkingId(notificationId);
    setError('');
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', notificationId)
      .eq('user_id', user.id);
    if (updateError) setError('This notification could not be marked as read.');
    else setMessages((current) => current.map((message) => message.id === notificationId ? { ...message, read_at: readAt } : message));
    setWorkingId(null);
  };

  const removeNotification = async (notificationId: string) => {
    if (!user?.id) return;
    setWorkingId(notificationId);
    setError('');
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id);
    if (deleteError) setError('This notification could not be removed.');
    else setMessages((current) => current.filter((message) => message.id !== notificationId));
    setWorkingId(null);
  };

  const markAllRead = async () => {
    if (!user?.id || counts.unread === 0) return;
    setWorkingId('all');
    setError('');
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (updateError) setError('Unread notifications could not be marked as read.');
    else setMessages((current) => current.map((message) => message.read_at ? message : { ...message, read_at: readAt }));
    setWorkingId(null);
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        driverName={title}
        subtitle={subtitle}
        headerActions={(
          <>
            <ActionButton tone="secondary" disabled={loading || workingId === 'all' || counts.unread === 0} onClick={() => void markAllRead()}>{workingId === 'all' ? 'Updating…' : 'Mark all read'}</ActionButton>
            <ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
          </>
        )}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        <div className="driver-board-layout driver-messages-board">
          <aside className="driver-filter-rail" aria-label="Notification filters">
            <div className="driver-filter-rail__header">Notification Inbox</div>
            <div className="driver-filter-rail__body">
              {tabLabels.map((item) => (
                <button key={item.id} type="button" className="driver-account-link" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span><span>{counts[item.id]}</span>
                </button>
              ))}
            </div>
          </aside>
          <main className="driver-board-main">
            <div className="driver-tab-strip" role="tablist" aria-label="Notification inbox filters">
              {tabLabels.map((item) => <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label} <span>{counts[item.id]}</span></button>)}
            </div>
            <div className="driver-board-summary"><span>{visibleMessages.length} notification{visibleMessages.length === 1 ? '' : 's'} · {counts.unread} unread · {counts.load_alerts} load alert{counts.load_alerts === 1 ? '' : 's'}</span></div>
            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading notifications…" /></div>
            ) : visibleMessages.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title={tab === 'load_alerts' ? 'No load alerts match this view' : 'No notifications match this filter'} description={tab === 'load_alerts' ? 'Real load-alert records will appear here when generated. CX-style matching preferences remain a separate backend parity item.' : undefined} /></div>
            ) : (
              <div className="driver-load-list">
                {visibleMessages.map((message) => (
                  <article key={message.id} className="driver-load-row" data-state={message.read_at ? 'read' : 'unread'}>
                    <div className="driver-load-row__top">
                      <div className="driver-load-cell"><span className="driver-cell-label">Notification</span><strong className="driver-cell-primary">{message.title}</strong><span className="driver-cell-secondary">{typeLabel(message.type)}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Details</span><strong className="driver-cell-primary">{message.body?.trim() || 'Open XDrive for details.'}</strong><span className="driver-cell-secondary">Recipient-scoped inbox record</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Created</span><strong className="driver-cell-primary">{formatDateTime(message.created_at)}</strong><span className="driver-cell-secondary">Operational notification</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Inbox state</span><strong className="driver-cell-primary">{message.read_at ? 'Read' : 'Unread'}</strong><span className="driver-cell-secondary"><StatusBadge value={message.read_at ? 'Read' : 'Unread'} tone={message.read_at ? 'grey' : 'orange'} /></span></div>
                    </div>
                    <div className="driver-load-row__meta">
                      <span>Notification #{message.id.slice(0, 8).toUpperCase()}</span>
                      {LOAD_ALERT_TYPES.has(String(message.type ?? '')) && <StatusBadge value="Load alert" tone="blue" />}
                      <StatusBadge value={message.read_at ? 'Read' : 'Unread'} tone={message.read_at ? 'grey' : 'orange'} />
                      <div className="driver-row-actions">
                        {!message.read_at && <ActionButton tone="secondary" disabled={workingId === message.id} onClick={() => void markRead(message.id)}>Mark read</ActionButton>}
                        <ActionButton tone="secondary" disabled={workingId === message.id} onClick={() => void removeNotification(message.id)}>Remove</ActionButton>
                      </div>
                    </div>
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
