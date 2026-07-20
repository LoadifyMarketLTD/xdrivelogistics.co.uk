'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  Panel,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

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
  return eventType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPreview(notification: NotificationRow) {
  const payload = notification.payload ?? {};
  const pickup =
    typeof payload.pickup_location === 'string' ? payload.pickup_location : null;
  const delivery =
    typeof payload.delivery_location === 'string' ? payload.delivery_location : null;
  const ref =
    typeof payload.job_ref === 'string'
      ? payload.job_ref
      : notification.entity_id.slice(0, 8).toUpperCase();

  if (pickup || delivery) {
    return `${ref}: ${pickup ?? 'Pickup'} to ${delivery ?? 'Delivery'}`;
  }

  return `Operational update linked to ${notification.entity_type.replace(/_/g, ' ')}.`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function DriverMessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<NotificationRow[]>([]);
  const [tab, setTab] = useState<TabId>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.companyId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: queryError } = await supabase
      .from('notification_events')
      .select(
        'id, event_type, entity_type, entity_id, payload, status, created_at, recipient_user_id'
      )
      .eq('company_id', user.companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (queryError) {
      setError('Messages are temporarily unavailable.');
      setMessages([]);
    } else {
      const rows = ((data ?? []) as NotificationRow[]).filter(
        (row) => !row.recipient_user_id || row.recipient_user_id === user.id
      );
      setMessages(rows);
    }

    setLoading(false);
  }, [user?.companyId, user?.id]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const visibleMessages = useMemo(() => {
    if (tab === 'pending') {
      return messages.filter((message) => message.status === 'pending');
    }
    if (tab === 'attention') {
      return messages.filter(
        (message) => message.status === 'failed' || message.status === 'skipped'
      );
    }
    return messages;
  }, [messages, tab]);

  const pendingCount = messages.filter((message) => message.status === 'pending').length;
  const attentionCount = messages.filter(
    (message) => message.status === 'failed' || message.status === 'skipped'
  ).length;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        driverName="Messages"
        subtitle="Operational notifications from dispatch, workflow triggers and company updates. Delivery status is shown accurately; personal read-state is not claimed because the current schema does not store it."
        headerActions={
          <ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </ActionButton>
        }
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}

        <KpiGrid>
          <KpiCard label="Messages" value={messages.length} tone="blue" />
          <KpiCard label="Pending delivery" value={pendingCount} tone="orange" />
          <KpiCard label="Needs attention" value={attentionCount} tone="red" />
        </KpiGrid>

        <Panel
          title="Notification register"
          description="Filters use backend delivery status, not an invented inbox read-state."
          actions={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {tabLabels.map((item) => (
                <ActionButton
                  key={item.id}
                  tone={tab === item.id ? 'primary' : 'secondary'}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </ActionButton>
              ))}
            </div>
          }
        >
          <DataTable
            columns={['Event', 'Details', 'Created', 'Delivery status']}
            rows={visibleMessages.map((message) => [
              <strong key="event">{formatTitle(message.event_type)}</strong>,
              formatPreview(message),
              formatDateTime(message.created_at),
              <StatusBadge
                key="status"
                value={message.status}
                tone={
                  message.status === 'sent'
                    ? 'green'
                    : message.status === 'pending'
                      ? 'orange'
                      : 'red'
                }
              />,
            ])}
            empty={
              <EmptyState
                title={loading ? 'Loading messages…' : 'No messages match this filter'}
              />
            }
          />
        </Panel>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
