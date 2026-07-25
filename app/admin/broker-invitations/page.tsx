'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

type BrokerInvitation = {
  id: string;
  broker_company_id: string;
  carrier_email: string | null;
  carrier_company_id: string | null;
  status: string;
  message: string | null;
  created_at: string;
  brokerCompanyName?: string | null;
};

function BrokerInvitationsContent() {
  const [invitations, setInvitations] = useState<BrokerInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState<string | null>(null);

  const getAuthHeader = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    return token ? 'Bearer ' + token : null;
  };

  const load = async () => {
    setLoading(true);
    setError('');

    const auth = await getAuthHeader();
    if (!auth) {
      setError('Session expired.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/carrier/broker-invitations', {
      headers: { Authorization: auth },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      invitations?: BrokerInvitation[];
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? 'Failed to load invitations.');
    } else {
      setInvitations(payload.invitations ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const respond = async (invitationId: string, action: 'accept' | 'reject') => {
    const label = action === 'accept' ? 'Accept' : 'Reject';
    if (!window.confirm(`${label} this broker invitation?`)) return;

    setWorking(invitationId);
    setError('');
    setNotice('');

    const auth = await getAuthHeader();
    if (!auth) {
      setError('Session expired.');
      setWorking(null);
      return;
    }

    const response = await fetch(`/api/broker/carrier-invitations/${invitationId}`, {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setWorking(null);

    if (!response.ok) {
      setError(payload.error ?? `${label} failed.`);
      return;
    }

    setNotice(`Invitation ${action === 'accept' ? 'accepted' : 'rejected'}.`);
    await load();
  };

  const pending = invitations.filter((i) => i.status === 'pending').length;
  const accepted = invitations.filter((i) => i.status === 'accepted').length;
  const rejected = invitations.filter((i) => i.status === 'rejected').length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Network"
        title="Broker Invitations"
        description="Broker companies that have invited your company into their preferred carrier network."
        actions={
          <ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </ActionButton>
        }
      />
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Pending" value={pending} tone="orange" />
        <KpiCard label="Accepted" value={accepted} tone="green" />
        <KpiCard label="Rejected" value={rejected} />
      </KpiGrid>
      <Panel
        title="Invitations"
        description="Accept to join a broker's preferred carrier network, or reject to decline."
      >
        <DataTable
          columns={['Broker company', 'Message', 'Invited', 'Status', 'Actions']}
          rows={invitations.map((inv) => [
            inv.brokerCompanyName ?? inv.broker_company_id.slice(0, 8),
            inv.message ?? '—',
            when(inv.created_at),
            <StatusBadge key="status" value={inv.status} />,
            inv.status === 'pending' ? (
              <span key="actions" style={{ display: 'flex', gap: '0.35rem' }}>
                <ActionButton
                  tone="primary"
                  disabled={working === inv.id}
                  onClick={() => void respond(inv.id, 'accept')}
                >
                  {working === inv.id ? '…' : 'Accept'}
                </ActionButton>
                <ActionButton
                  tone="danger"
                  disabled={working === inv.id}
                  onClick={() => void respond(inv.id, 'reject')}
                >
                  {working === inv.id ? '…' : 'Reject'}
                </ActionButton>
              </span>
            ) : (
              <span key="na" style={{ color: '#64748b', fontSize: '0.72rem' }}>
                —
              </span>
            ),
          ])}
          empty={
            <EmptyState
              title={loading ? 'Loading…' : 'No broker invitations'}
              description="When a broker invites your company into their network, invitations will appear here."
            />
          }
        />
      </Panel>
    </PageFrame>
  );
}

export default function BrokerInvitationsPage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff', 'broker', 'driver']}>
      <BrokerInvitationsContent />
    </ProtectedRoute>
  );
}
