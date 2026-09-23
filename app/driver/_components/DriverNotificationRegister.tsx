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
const tabLabels: Array<{ id: TabId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'load_alerts', label: 'Load Alerts' },
  { id: 'operational', label: 'Operational' },
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
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (sessionError || !token) {
      setError('Your session has expired. Please sign in again.');
      setMessages([]);
      setLoading(false);
      return;
    }
    const response = await fetch('/api/driver/notifications', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => ({}))) as { notifications?: NotificationRow[]; error?: string };
    if (!response.ok) {
      setError(payload.error ?? 'Notifications are temporarily unavailable.');
      setMessages([]);
    } else {
      setMessages(payload.notifications ?? []);
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
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setWorkingId(null);
      return;
    }
    const response = await fetch(`/api/driver/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token },
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; readAt?: string };
    if (!response.ok) setError(payload.error ?? 'This notification could not be marked as read.');
    else {
      const readAt = payload.readAt ?? new Date().toISOString();
      setMessages((current) => current.map((message) => message.id === notificationId ? { ...message, read_at: readAt } : message));
    }
    setWorkingId(null);
  };

  const removeNotification = async (notificationId: string) => {
    if (!user?.id) return;
    setWorkingId(notificationId);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setWorkingId(null);
      return;
    }
    const response = await fetch(`/api/driver/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) setError(payload.error ?? 'This notification could not be removed.');
    else setMessages((current) => current.filter((message) => message.id !== notificationId));
    setWorkingId(null);
  };

  const markAllRead = async () => {
    if (!user?.id || counts.unread === 0) return;
    setWorkingId('all');
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setWorkingId(null);
      return;
    }
    const response = await fetch('/api/driver/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; readAt?: string };
    if (!response.ok) setError(payload.error ?? 'Unread notifications could not be marked as read.');
    else {
      const readAt = payload.readAt ?? new Date().toISOString();
      setMessages((current) => current.map((message) => message.read_at ? message : { ...message, read_at: readAt }));
    }
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

        <div className="driver-notification-register">
          <div className="driver-tab-strip" role="tablist" aria-label="Notification inbox filters">
            {tabLabels.map((item) => (
              <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>
                {item.label} <span>{counts[item.id]}</span>
              </button>
            ))}
          </div>

          <div className="driver-register-toolbar">
            <div>
              <strong>Notification inbox</strong>
              <span>{visibleMessages.length} visible · {counts.unread} unread</span>
            </div>
          </div>

          {loading ? (
            <EmptyState compact title="Loading notifications…" />
          ) : visibleMessages.length === 0 ? (
            <EmptyState compact title={tab === 'load_alerts' ? 'No load alerts match this view' : 'No notifications match this filter'} />
          ) : (
            <div className="driver-register-table-wrap">
              <table className="driver-register-table driver-notification-table">
                <thead>
                  <tr>
                    <th>Notification</th>
                    <th>Details</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMessages.map((message) => (
                    <tr key={message.id} data-state={message.read_at ? 'read' : 'unread'}>
                      <td>
                        <strong>{message.title}</strong>
                        <small>{typeLabel(message.type)}</small>
                      </td>
                      <td>{message.body?.trim() || 'Open XDrive for details.'}</td>
                      <td>{formatDateTime(message.created_at)}</td>
                      <td>
                        <div className="driver-register-statuses">
                          {LOAD_ALERT_TYPES.has(String(message.type ?? '')) && <StatusBadge value="Load alert" tone="blue" />}
                          <StatusBadge value={message.read_at ? 'Read' : 'Unread'} tone={message.read_at ? 'grey' : 'orange'} />
                        </div>
                      </td>
                      <td>
                        <div className="driver-register-actions">
                          {!message.read_at && <ActionButton tone="secondary" disabled={workingId === message.id} onClick={() => void markRead(message.id)}>Mark read</ActionButton>}
                          <ActionButton tone="secondary" disabled={workingId === message.id} onClick={() => void removeNotification(message.id)}>Remove</ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
