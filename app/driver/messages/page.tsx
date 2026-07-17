'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

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

type TabId = 'all' | 'unread' | 'important';

const tabLabels: Array<{ id: TabId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'important', label: 'Important' },
];

function formatTitle(eventType: string) {
  return eventType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPreview(notification: NotificationRow) {
  const payload = notification.payload ?? {};
  const pickup = typeof payload.pickup_location === 'string' ? payload.pickup_location : null;
  const delivery = typeof payload.delivery_location === 'string' ? payload.delivery_location : null;
  const ref = typeof payload.job_ref === 'string' ? payload.job_ref : notification.entity_id.slice(0, 8).toUpperCase();
  if (pickup || delivery) return `${ref}: ${pickup ?? 'Pickup'} to ${delivery ?? 'Delivery'}`;
  return `Operational update linked to ${notification.entity_type}.`;
}

export default function DriverMessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<NotificationRow[]>([]);
  const [tab, setTab] = useState<TabId>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: queryError } = await supabase
      .from('notification_events')
      .select('id, event_type, entity_type, entity_id, payload, status, created_at, recipient_user_id')
      .eq('company_id', user.companyId)
      .order('created_at', { ascending: false })
      .limit(40);

    if (queryError) {
      setError('Messages are temporarily unavailable.');
      setMessages([]);
    } else {
      const rows = ((data ?? []) as NotificationRow[]).filter((row) => !row.recipient_user_id || row.recipient_user_id === user.id);
      setMessages(rows);
    }

    setLoading(false);
  }, [user?.companyId, user?.id]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const visibleMessages = useMemo(() => {
    if (tab === 'unread') return messages.filter((message) => message.status === 'pending');
    if (tab === 'important') return messages.filter((message) => message.status === 'failed' || message.status === 'skipped');
    return messages;
  }, [messages, tab]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell><div><h1 className="text-2xl font-bold">Messages</h1><p className="text-sm text-slate-500 mb-4">Live operational notifications from dispatch, workflow triggers, and company updates.</p></div>
        <section style={{ display: 'grid', gap: '0.9rem' }}>
          <div style={{ borderRadius: '18px', border: '1px solid #24324D', background: '#0D1424', padding: '1.1rem' }}>
            <h1 style={{ margin: 0, color: '#F8FAFC', fontSize: '1.45rem' }}>Messages</h1>
            <p style={{ margin: '0.5rem 0 0', color: '#A9B7D0', lineHeight: 1.45 }}>Operational notifications are loaded from the live backend. Inbox read-state stays in early access until the dedicated driver messaging contract is expanded.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', padding: '0.35rem', borderRadius: '18px', border: '1px solid #24324D', background: '#0D1424' }}>
            {tabLabels.map((item) => {
              const active = item.id === tab;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  style={{ minHeight: '46px', borderRadius: '14px', border: '1px solid transparent', background: active ? '#3A6FF7' : 'transparent', color: active ? '#F8FAFC' : '#A9B7D0', fontWeight: 800, cursor: 'pointer' }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {error ? <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#FECACA', borderRadius: '16px', padding: '0.8rem' }}>{error}</div> : null}
          {loading ? <div style={{ color: '#A9B7D0', textAlign: 'center', padding: '2rem 0' }}>Loading messages…</div> : null}

          {!loading && visibleMessages.length === 0 ? (
            <div style={{ borderRadius: '18px', border: '1px solid #24324D', background: '#0D1424', padding: '1.1rem', color: '#A9B7D0' }}>
              No messages match this filter.
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {visibleMessages.map((message) => (
              <div key={message.id} style={{ borderRadius: '18px', border: '1px solid #24324D', background: '#0D1424', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#F8FAFC', fontWeight: 800, fontSize: '1rem' }}>{formatTitle(message.event_type)}</div>
                    <div style={{ color: '#A9B7D0', marginTop: '0.35rem', lineHeight: 1.4 }}>{formatPreview(message)}</div>
                  </div>
                  <div style={{ color: '#A9B7D0', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {new Date(message.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
