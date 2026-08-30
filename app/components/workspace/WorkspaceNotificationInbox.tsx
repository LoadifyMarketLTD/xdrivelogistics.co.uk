'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getActionCentreRoute,
  resolveRoleScopedHref,
  type ActionCentreRole,
} from './actionCentreConfig';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from './WorkspaceUI';

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  read_at: string | null;
  created_at: string;
};

type InboxTab = 'all' | 'unread' | 'load_alerts' | 'operational';

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
  'carrier_invited',
  'carrier_accepted',
  'carrier_rejected',
  ...LOAD_ALERT_TYPES,
]);

function human(value: string | null) {
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Notification';
}

function when(value: string) {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function entityTypeFromNotification(type: string | null) {
  const value = String(type ?? '').toLowerCase();
  if (value.includes('invoice')) return 'invoice';
  if (value.includes('bid') || value.includes('quote')) return 'quote';
  if (value.includes('job') || value.includes('pod') || value.includes('tracking')) return 'job';
  if (value.includes('document')) return 'document';
  if (value.includes('carrier') || value.includes('load_alert') || value.includes('won_load') || value.includes('return_journey')) return 'load';
  return '';
}

export default function WorkspaceNotificationInbox({
  role,
  eyebrow = 'Workspace notifications',
  title = 'Notifications',
  description = 'Recipient-scoped operational, marketplace and commercial notifications for the current account.',
}: {
  role: Exclude<ActionCentreRole, 'platform_owner' | 'driver'>;
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [tab, setTab] = useState<InboxTab>('all');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id) {
      setRows([]);
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
      .limit(150);
    if (queryError) {
      setError('Notifications are temporarily unavailable.');
      setRows([]);
    } else {
      setRows((data ?? []) as NotificationRow[]);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: rows.length,
    unread: rows.filter((row) => !row.read_at).length,
    load_alerts: rows.filter((row) => LOAD_ALERT_TYPES.has(String(row.type ?? ''))).length,
    operational: rows.filter((row) => OPERATIONAL_TYPES.has(String(row.type ?? ''))).length,
  }), [rows]);

  const visible = useMemo(() => {
    if (tab === 'unread') return rows.filter((row) => !row.read_at);
    if (tab === 'load_alerts') return rows.filter((row) => LOAD_ALERT_TYPES.has(String(row.type ?? '')));
    if (tab === 'operational') return rows.filter((row) => OPERATIONAL_TYPES.has(String(row.type ?? '')));
    return rows;
  }, [rows, tab]);

  const markRead = async (id: string) => {
    if (!user?.id) return;
    setWorking(id);
    setError('');
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', id)
      .eq('user_id', user.id);
    if (updateError) setError('This notification could not be marked as read.');
    else setRows((current) => current.map((row) => row.id === id ? { ...row, read_at: readAt } : row));
    setWorking(null);
  };

  const markAllRead = async () => {
    if (!user?.id || counts.unread === 0) return;
    setWorking('all');
    setError('');
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (updateError) setError('Unread notifications could not be marked as read.');
    else setRows((current) => current.map((row) => row.read_at ? row : { ...row, read_at: readAt }));
    setWorking(null);
  };

  const remove = async (id: string) => {
    if (!user?.id) return;
    setWorking(id);
    setError('');
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (deleteError) setError('This notification could not be removed.');
    else setRows((current) => current.filter((row) => row.id !== id));
    setWorking(null);
  };

  const openNotification = async (row: NotificationRow) => {
    if (!row.read_at) await markRead(row.id);
    const entityType = entityTypeFromNotification(row.type);
    router.push(entityType ? resolveRoleScopedHref(role, entityType, row.id) : getActionCentreRoute(role, row.id));
  };

  const tabs: Array<{ id: InboxTab; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'load_alerts', label: 'Load Alerts' },
    { id: 'operational', label: 'Operational' },
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={(
          <>
            <ActionButton tone="secondary" disabled={loading || working === 'all' || counts.unread === 0} onClick={() => void markAllRead()}>{working === 'all' ? 'Updating…' : 'Mark all read'}</ActionButton>
            <ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
          </>
        )}
      />
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <div className="workspace-tab-strip" role="tablist" aria-label="Notification inbox filters" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>
            {item.label} {counts[item.id]}
          </button>
        ))}
      </div>
      <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
        <span><strong>{visible.length}</strong> notification{visible.length === 1 ? '' : 's'} in this view</span>
        <span>{counts.unread} unread · {counts.load_alerts} load alert{counts.load_alerts === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div className="workspace-panel"><EmptyState compact title="Loading notifications…" /></div>
      ) : visible.length === 0 ? (
        <div className="workspace-panel"><EmptyState title={tab === 'load_alerts' ? 'No load alerts in this view' : 'No notifications in this view'} description={tab === 'load_alerts' ? 'CX-style matching preferences and alert generation remain a separate backend parity item; this tab displays real alert records when they exist.' : undefined} /></div>
      ) : (
        <div className="workspace-record-list">
          {visible.map((row) => (
            <article key={row.id} className="workspace-operational-row" data-state={row.read_at ? 'read' : 'unread'}>
              <div className="workspace-operational-row__top" style={{ gridTemplateColumns: 'minmax(180px,1fr) minmax(280px,2fr) minmax(150px,.8fr) minmax(180px,1fr)' }}>
                <div className="workspace-operational-cell"><span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>EVENT</span><strong>{row.title}</strong><span style={{ color: '#64748b', fontSize: 11 }}>{human(row.type)}</span></div>
                <div className="workspace-operational-cell"><span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>DETAILS</span><strong>{row.body?.trim() || 'Open XDrive for details.'}</strong><span style={{ color: '#64748b', fontSize: 11 }}>Recipient-scoped notification</span></div>
                <div className="workspace-operational-cell"><span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>CREATED</span><strong>{when(row.created_at)}</strong></div>
                <div className="workspace-operational-cell"><span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>STATE / ACTION</span><StatusBadge value={row.read_at ? 'Read' : 'Unread'} tone={row.read_at ? 'grey' : 'orange'} /><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><ActionButton tone="secondary" disabled={working === row.id} onClick={() => void openNotification(row)}>Open</ActionButton>{!row.read_at && <ActionButton tone="secondary" disabled={working === row.id} onClick={() => void markRead(row.id)}>Mark read</ActionButton>}<ActionButton tone="secondary" disabled={working === row.id} onClick={() => void remove(row.id)}>Remove</ActionButton></div></div>
              </div>
              <div className="workspace-record-meta"><span>Notification #{row.id.slice(0, 8).toUpperCase()}</span>{LOAD_ALERT_TYPES.has(String(row.type ?? '')) && <StatusBadge value="Load alert" tone="blue" />}<StatusBadge value={row.read_at ? 'Read' : 'Unread'} tone={row.read_at ? 'grey' : 'orange'} /></div>
            </article>
          ))}
        </div>
      )}
    </PageFrame>
  );
}
