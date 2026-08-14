'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type CarrierInvitation = {
  id: string;
  invited_email: string | null;
  carrier_company_id: string | null;
  carrierCompanyName: string | null;
  status: string;
  message: string | null;
  created_at: string;
};

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function BrokerCarrierNetworkPage() {
  const [invitations, setInvitations] = useState<CarrierInvitation[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [carrierEmail, setCarrierEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const getAuthHeader = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    return token ? `Bearer ${token}` : null;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired.'); setLoading(false); return; }
    const response = await fetch('/api/broker/carrier-invitations', { headers: { Authorization: auth } });
    const payload = await response.json().catch(() => ({})) as { invitations?: CarrierInvitation[]; canManage?: boolean; error?: string };
    if (!response.ok) setError(payload.error ?? 'Failed to load carrier network.');
    else {
      setInvitations(payload.invitations ?? []);
      setCanManage(Boolean(payload.canManage));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async () => {
    if (!carrierEmail.trim()) { setError('Carrier email is required.'); return; }
    setWorking('invite');
    setError('');
    setNotice('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired.'); setWorking(null); return; }
    const response = await fetch('/api/broker/carrier-invitations', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrierEmail: carrierEmail.trim(), message: inviteMessage.trim() || undefined }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setError(payload.error ?? 'Invitation failed.'); return; }
    setCarrierEmail('');
    setInviteMessage('');
    setNotice('Carrier invitation sent.');
    await load();
  };

  const revoke = async (invitationId: string) => {
    if (!window.confirm('Revoke this carrier invitation?')) return;
    setWorking(invitationId);
    setError('');
    setNotice('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired.'); setWorking(null); return; }
    const response = await fetch('/api/broker/carrier-invitations', {
      method: 'DELETE',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setError(payload.error ?? 'Revoke failed.'); return; }
    setNotice('Invitation revoked.');
    await load();
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invitations.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (!term) return true;
      return `${row.invited_email ?? ''} ${row.carrierCompanyName ?? ''} ${row.carrier_company_id ?? ''}`.toLowerCase().includes(term);
    });
  }, [invitations, search, status]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier network"
        title="Carriers"
        description="Search and manage the broker preferred carrier network from one operational directory."
        actions={<ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      />
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Carrier filters">
          <div className="workspace-filter-rail__header">Search Carriers</div>
          <div className="workspace-filter-rail__body">
            <label>COMPANY / EMAIL<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Company, email or ID" /></label>
            <label>STATUS<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="revoked">Revoked</option></select></label>
            <ActionButton tone="secondary" onClick={() => { setSearch(''); setStatus('all'); }}>Clear</ActionButton>
            {canManage && (
              <>
                <div className="workspace-filter-rail__header">Invite Carrier</div>
                <label>EMAIL<input value={carrierEmail} onChange={(event) => setCarrierEmail(event.target.value)} placeholder="carrier@company.com" /></label>
                <label>MESSAGE<input value={inviteMessage} onChange={(event) => setInviteMessage(event.target.value)} placeholder="Optional message" /></label>
                <ActionButton tone="primary" disabled={working === 'invite'} onClick={() => void invite()}>{working === 'invite' ? 'Sending…' : 'Send invitation'}</ActionButton>
              </>
            )}
          </div>
        </aside>

        <main className="workspace-board-main">
          <div className="workspace-record-meta"><span><strong>{rows.length}</strong> carrier record(s)</span><span>Network data source: broker carrier invitations</span></div>
          {loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading carriers…" /></div>
          ) : rows.length === 0 ? (
            <div className="workspace-panel"><EmptyState compact title="No matching carriers" description="Adjust the filters or invite a carrier company." /></div>
          ) : (
            <div className="workspace-record-list">
              {rows.map((row) => {
                const open = expanded === row.id;
                return (
                  <article key={row.id} className="workspace-operational-row" data-state={row.status}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Company</span><strong>{row.carrierCompanyName ?? 'Company unavailable'}</strong><div>{row.invited_email ?? 'No email'}</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Availability</span><strong>Unavailable</strong><div>Not exposed by carrier invitation data</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Vehicles</span><strong>Unavailable</strong><div>Not exposed by carrier invitation data</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Status / Actions</span><StatusBadge value={row.status} /><div style={{ marginTop: 4 }}><ActionButton tone="secondary" onClick={() => setExpanded(open ? null : row.id)}>{open ? 'Close' : 'Details'}</ActionButton></div></div>
                    </div>
                    <div className="workspace-record-meta"><span>Carrier #{(row.carrier_company_id ?? row.id).slice(0, 8).toUpperCase()}</span><span>Invited {when(row.created_at)}</span></div>
                    {open && (
                      <div className="workspace-record-details">
                        <div className="workspace-detail-grid">
                          <div className="workspace-detail-item"><strong>Company</strong><div>{row.carrierCompanyName ?? 'Unavailable'}</div></div>
                          <div className="workspace-detail-item"><strong>Availability</strong><div>Unavailable from current carrier-network dataset.</div></div>
                          <div className="workspace-detail-item"><strong>Vehicles</strong><div>Unavailable from current carrier-network dataset.</div></div>
                          <div className="workspace-detail-item"><strong>Documents</strong><div>Unavailable from current carrier-network dataset.</div></div>
                          <div className="workspace-detail-item"><strong>Ratings</strong><div>Unavailable from current carrier-network dataset.</div></div>
                          <div className="workspace-detail-item"><strong>Invitation status</strong><div>{row.status}</div></div>
                          <div className="workspace-detail-item"><strong>Email</strong><div>{row.invited_email ?? 'Unavailable'}</div></div>
                          <div className="workspace-detail-item"><strong>Message</strong><div>{row.message ?? 'No message supplied'}</div></div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                          {row.invited_email && <ActionButton tone="secondary" onClick={() => { window.location.href = `mailto:${row.invited_email}`; }}>Email carrier</ActionButton>}
                          {canManage && row.status === 'pending' && <ActionButton tone="danger" disabled={working === row.id} onClick={() => void revoke(row.id)}>{working === row.id ? 'Revoking…' : 'Revoke invitation'}</ActionButton>}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
