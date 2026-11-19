'use client';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../AuthContext';
import {resolveWorkspaceRole} from '../../../lib/workspaceRole';
import {filterCompanyNotifications,notificationCategory,notificationCategoryLabel,notificationModule,type NotificationCategory} from './companyAdminNotificationsModel';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getActionCentreRoute,
  resolveRoleScopedHref,
  type ActionCentreRole,
} from './actionCentreConfig';
import NotificationPreferencesPanel from './NotificationPreferencesPanel';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
  WorkspaceDialog,
} from './WorkspaceUI';

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  read_at: string | null;
  created_at: string;
};

type InboxTab = 'all' | 'unread' | 'load_alerts' | 'operational' | NotificationCategory;

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
  const companyAdmin=role==='admin'&&(user?.workspaceRole??resolveWorkspaceRole(user))==='company_admin';
  const [query,setQuery]=useState('');
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [readFilter,setReadFilter]=useState<'all'|'read'|'unread'>('all');
  const [detailId,setDetailId]=useState<string|null>(null);
  const [removeId,setRemoveId]=useState<string|null>(null);
  const [dialogError,setDialogError]=useState('');
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [tab, setTab] = useState<InboxTab>('all');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
    const accessToken = readRouteAuthAccessToken();
    if (!accessToken) {
      setError('Notifications are temporarily unavailable.');
      setRows([]);
      setLoading(false);
      return;
    }
    const response = await fetch('/api/workspace/notifications', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
    const payload = (await response.json().catch(() => ({}))) as { notifications?: NotificationRow[]; error?: string };
    if (!response.ok) {
      setError(payload.error ?? 'Notifications are temporarily unavailable.');
      setRows([]);
    } else setRows(payload.notifications ?? []);
    } catch {setRows([]);setError('Notifications could not be loaded. Please retry.');} finally {setLoading(false);}
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    jobs:rows.filter(row=>notificationCategory(row.type)==='jobs').length,
    quotes:rows.filter(row=>notificationCategory(row.type)==='quotes').length,
    bookings:rows.filter(row=>notificationCategory(row.type)==='bookings').length,
    invoices:rows.filter(row=>notificationCategory(row.type)==='invoices').length,
    system:rows.filter(row=>notificationCategory(row.type)==='system').length,
    all: rows.length,
    unread: rows.filter((row) => !row.read_at).length,
    load_alerts: rows.filter((row) => companyAdmin?notificationCategory(row.type)==='load_alerts':LOAD_ALERT_TYPES.has(String(row.type ?? ''))).length,
    operational: rows.filter((row) => companyAdmin?notificationCategory(row.type)!=='system':OPERATIONAL_TYPES.has(String(row.type ?? ''))).length,
  }), [rows,companyAdmin]);

  const invalidRange=Boolean(companyAdmin&&dateFrom&&dateTo&&dateFrom>dateTo);
  const visible = useMemo(() => {
    if(companyAdmin)return invalidRange?[]:filterCompanyNotifications(rows,{tab,query,from:dateFrom,to:dateTo,status:readFilter});
    if (tab === 'unread') return rows.filter((row) => !row.read_at);
    if (tab === 'load_alerts') return rows.filter((row) => LOAD_ALERT_TYPES.has(String(row.type ?? '')));
    if (tab === 'operational') return rows.filter((row) => OPERATIONAL_TYPES.has(String(row.type ?? '')));
    return rows;
  }, [rows, tab,companyAdmin,query,dateFrom,dateTo,readFilter,invalidRange]);
  const selected=rows.find(row=>row.id===detailId)??null;
  const removal=rows.find(row=>row.id===removeId)??null;

  const markRead = async (id: string) => {
    if (!user?.id || working) return;
    setWorking(id);
    setError('');
    try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? null;
    if (!accessToken) { setError('This notification could not be marked as read.'); setWorking(null); return; }
    const response = await fetch(`/api/workspace/notifications/${encodeURIComponent(id)}`, {
      method: 'PATCH', signal:AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = (await response.json().catch(() => ({}))) as { readAt?: string; error?: string };
    if (!response.ok || !payload.readAt) {const message=payload.error ?? 'This notification could not be marked as read.';setError(message);if(companyAdmin)setDialogError(message);}
    else setRows((current) => current.map((row) => row.id === id ? { ...row, read_at: payload.readAt ?? row.read_at } : row));
    } catch {setError('The notification action could not be completed. Please retry.');if(companyAdmin)setDialogError('The notification action could not be completed. Please retry.');} finally {setWorking(null);}
  };

  const markAllRead = async () => {
    if (!user?.id || working || counts.unread === 0) return;
    setWorking('all');
    setError('');
    try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? null;
    if (!accessToken) { setError('Unread notifications could not be marked as read.'); setWorking(null); return; }
    const response = await fetch('/api/workspace/notifications', {
      method: 'PATCH', signal:AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read_all' }),
    });
    const payload = (await response.json().catch(() => ({}))) as { readAt?: string; error?: string };
    if (!response.ok || !payload.readAt) setError(payload.error ?? 'Unread notifications could not be marked as read.');
    else setRows((current) => current.map((row) => row.read_at ? row : { ...row, read_at: payload.readAt ?? row.read_at }));
    } catch {setError('The notification action could not be completed. Please retry.');if(companyAdmin)setDialogError('The notification action could not be completed. Please retry.');} finally {setWorking(null);}
  };

  const remove = async (id: string) => {
    if (!user?.id || working) return;
    setWorking(id);
    setError('');
    try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? null;
    if (!accessToken) { setError('This notification could not be removed.');setDialogError('Your session is unavailable. Please refresh and sign in again.'); setWorking(null); return; }
    const response = await fetch(`/api/workspace/notifications/${encodeURIComponent(id)}`, {
      method: 'DELETE', signal:AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {const message=payload.error ?? 'This notification could not be removed.';setError(message);setDialogError(message);}
    else {setRows((current) => current.filter((row) => row.id !== id));setRemoveId(null);setDetailId(null);}
    } catch {setError('The notification action could not be completed. Please retry.');if(companyAdmin)setDialogError('The notification action could not be completed. Please retry.');} finally {setWorking(null);}
  };

  const openNotification = async (row: NotificationRow) => {
    if(companyAdmin){setDetailId(row.id);setDialogError('');if(!row.read_at)await markRead(row.id);return;}
    if (!row.read_at) await markRead(row.id);
    const entityType = entityTypeFromNotification(row.type);
    router.push(entityType ? resolveRoleScopedHref(role, entityType, row.id) : getActionCentreRoute(role, row.id));
  };

  const tabs: Array<{ id: InboxTab; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'load_alerts', label: 'Load Alerts' },
    { id: 'operational', label: 'Operational' },
    ...(companyAdmin?(['jobs','quotes','bookings','invoices','system'] as const).map(id=>({id,label:notificationCategoryLabel[id]})):[]),
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {preferencesOpen && <NotificationPreferencesPanel />}
      {companyAdmin&&selected&&!removal&&<WorkspaceDialog ariaLabel="Notification details" title={selected.title} description={notificationCategoryLabel[notificationCategory(selected.type)]+' · '+when(selected.created_at)} onDismiss={()=>setDetailId(null)} actions={<><ActionButton tone="secondary" onClick={()=>setDetailId(null)}>Close</ActionButton>{notificationModule(selected.type)&&<ActionButton onClick={()=>router.push(notificationModule(selected.type)!.href)}>{notificationModule(selected.type)!.label}</ActionButton>}</>}><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{selected.body?.trim()||'No additional details supplied.'}</p><p><StatusBadge value={selected.read_at?'Read':'Unread'}/></p><p style={{fontSize:12,color:'#475569'}}>This notification does not provide a verified record link. The action opens the corresponding workspace register.</p>{dialogError&&<AlertBanner tone="danger">{dialogError}</AlertBanner>}</WorkspaceDialog>}
      {companyAdmin&&removal&&<WorkspaceDialog ariaLabel="Remove notification" title="Remove this notification?" description="This removes the notification from your own inbox, not the underlying job, quote or invoice." dismissDisabled={Boolean(working)} onDismiss={()=>{setRemoveId(null);setDialogError('')}} actions={<><ActionButton tone="secondary" disabled={Boolean(working)} onClick={()=>setRemoveId(null)}>Cancel</ActionButton><ActionButton tone="danger" disabled={Boolean(working)} onClick={()=>void remove(removal.id)}>Confirm remove</ActionButton></>}><p>{removal.title}</p>{dialogError&&<AlertBanner tone="danger">{dialogError}</AlertBanner>}</WorkspaceDialog>}

      <div className={companyAdmin?'company-admin-inbox-nav':undefined}><div className="workspace-tab-strip" role="tablist" aria-label="Notification inbox filters" style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', marginBottom: 4 }}>
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>
            {item.label} {counts[item.id]}
          </button>
        ))}
        {!companyAdmin&&<span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <ActionButton tone="secondary" onClick={() => setPreferencesOpen((current) => !current)}>{preferencesOpen ? 'Hide Preferences' : 'Preferences'}</ActionButton>
          <ActionButton tone="secondary" disabled={loading || Boolean(working) || counts.unread === 0} onClick={() => void markAllRead()}>{working === 'all' ? 'Updating…' : 'Mark all read'}</ActionButton>
          <ActionButton tone="secondary" disabled={loading || Boolean(working)} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
        </span>}
      </div>{companyAdmin&&<div className="company-admin-inbox-actions" role="group" aria-label="Inbox actions"><ActionButton tone="secondary" onClick={()=>setPreferencesOpen(current=>!current)}>{preferencesOpen?'Hide Preferences':'Preferences'}</ActionButton><ActionButton tone="secondary" disabled={loading||Boolean(working)||counts.unread===0} onClick={()=>void markAllRead()}>{working==='all'?'Updating…':'Mark all read'}</ActionButton><ActionButton tone="secondary" disabled={loading||Boolean(working)} onClick={()=>void load()}>{loading?'Refreshing…':'Refresh'}</ActionButton></div>}</div>
      {companyAdmin&&<section className="company-admin-inbox-filters" aria-label="Search notifications"><label>Search<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Title, message or event"/></label><label>From<input type="date" value={dateFrom} onChange={event=>setDateFrom(event.target.value)}/></label><label>To<input type="date" value={dateTo} onChange={event=>setDateTo(event.target.value)}/></label><label>Read status<select value={readFilter} onChange={event=>setReadFilter(event.target.value as 'all'|'read'|'unread')}><option value="all">All</option><option value="read">Read</option><option value="unread">Unread</option></select></label><ActionButton tone="secondary" onClick={()=>{setQuery('');setDateFrom('');setDateTo('');setReadFilter('all');setTab('all')}}>Clear filters</ActionButton>{invalidRange&&<AlertBanner tone="danger">From date must not be after To date.</AlertBanner>}</section>}
      {companyAdmin&&rows.length>=150&&<AlertBanner tone="warning">Showing the latest 150 notifications. Filters and tab counts apply to these loaded records; Mark all read applies to the entire recipient inbox.</AlertBanner>}
      <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
        <span><strong>{visible.length}</strong> notification{visible.length === 1 ? '' : 's'} in this view</span>
        <span>{counts.unread} unread · {counts.load_alerts} load alert{counts.load_alerts === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div className="workspace-panel"><EmptyState compact title="Loading notifications…" /></div>
      ) : visible.length === 0 ? (
        <div className="workspace-panel"><EmptyState title={tab === 'load_alerts' ? 'No load alerts in this view' : 'No notifications in this view'} description={tab === 'load_alerts' ? 'Matching preferences and alert generation are active; this tab displays real load-alert records delivered to this account.' : undefined} /></div>
      ) : (
        <div className="workspace-record-list">
          {visible.map((row) => (
            <article key={row.id} className={companyAdmin?'workspace-operational-row company-admin-inbox-row':'workspace-operational-row'} data-state={row.read_at ? 'read' : 'unread'}>
              <div className="workspace-operational-row__top" style={{ gridTemplateColumns: 'minmax(180px,1fr) minmax(280px,2fr) minmax(150px,.8fr) minmax(180px,1fr)' }}>
                <div className="workspace-operational-cell"><span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>EVENT</span><strong>{row.title}</strong><span style={{ color: '#64748b', fontSize: 11 }}>{human(row.type)}</span></div>
                <div className="workspace-operational-cell"><span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>DETAILS</span><strong>{row.body?.trim() || 'Open XDrive for details.'}</strong><span style={{ color: '#64748b', fontSize: 11 }}>Recipient-scoped notification</span></div>
                <div className="workspace-operational-cell"><span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>CREATED</span><strong>{when(row.created_at)}</strong></div>
                <div className="workspace-operational-cell"><span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>STATE / ACTION</span><StatusBadge value={row.read_at ? 'Read' : 'Unread'} tone={row.read_at ? 'grey' : 'orange'} /><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><ActionButton tone="secondary" disabled={companyAdmin?Boolean(working)||loading:working === row.id} onClick={() => void openNotification(row)}>Open</ActionButton>{!row.read_at && <ActionButton tone="secondary" disabled={companyAdmin?Boolean(working)||loading:working === row.id} onClick={() => void markRead(row.id)}>Mark read</ActionButton>}<ActionButton tone="secondary" disabled={companyAdmin?Boolean(working)||loading:working === row.id} onClick={() => {if(companyAdmin){setDialogError('');setRemoveId(row.id)}else void remove(row.id)}}>Remove</ActionButton></div></div>
              </div>
              <div className="workspace-record-meta"><span>Notification #{row.id.slice(0, 8).toUpperCase()}</span>{companyAdmin?<StatusBadge value={notificationCategoryLabel[notificationCategory(row.type)]} tone="blue"/>:<>{LOAD_ALERT_TYPES.has(String(row.type ?? '')) && <StatusBadge value="Load alert" tone="blue" />}<StatusBadge value={row.read_at ? 'Read' : 'Unread'} tone={row.read_at ? 'grey' : 'orange'} /></>}</div>
            </article>
          ))}
        </div>
      )}
    </PageFrame>
  );
}
