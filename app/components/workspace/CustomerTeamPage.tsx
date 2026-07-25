'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
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
} from './WorkspaceUI';

type TeamMember = {
  id: string;
  userId: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: 'owner' | 'admin' | 'dispatcher' | 'viewer';
  membershipStatus: 'invited' | 'active' | 'suspended';
  profileStatus: string | null;
  createdAt: string;
  isCurrentUser: boolean;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const ROLE_OPTIONS: Array<TeamMember['role']> = ['owner', 'admin', 'dispatcher', 'viewer'];

export default function CustomerTeamPage() {
  const workspace = useCompanyWorkspaceData();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'dispatcher' | 'viewer'>('viewer');

  const getAuthHeader = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    return accessToken ? ['Bearer', accessToken].join(' ') : null;
  }, []);

  const load = useCallback(async () => {
    if (!workspace.companyId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    const authHeader = await getAuthHeader();
    if (!authHeader) {
      setError('Your session has expired. Please sign in again.');
      setMembers([]);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ companyId: workspace.companyId });
    const response = await fetch(`/api/customer/team?${params.toString()}`, {
      headers: { Authorization: authHeader },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      members?: TeamMember[];
      canManageTeam?: boolean;
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? 'Unable to load the company team.');
      setMembers([]);
      setCanManageTeam(false);
    } else {
      setMembers(Array.isArray(payload.members) ? payload.members : []);
      setCanManageTeam(Boolean(payload.canManageTeam));
    }

    setLoading(false);
  }, [getAuthHeader, workspace.companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runTeamAction = async (body: Record<string, unknown>, successMessage: string) => {
    if (!workspace.companyId) return;
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    const response = await fetch('/api/customer/team', {
      method: 'PATCH',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyId: workspace.companyId,
        ...body,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? 'Team update failed.');
      return;
    }

    setNotice(successMessage);
    await load();
  };

  const sendInvite = async () => {
    if (!workspace.companyId) return;
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    if (!inviteEmail.trim()) {
      setError('Invite email is required.');
      return;
    }

    setPendingActionId('invite');
    setError('');
    setNotice('');
    const response = await fetch('/api/customer/team', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyId: workspace.companyId,
        email: inviteEmail.trim(),
        role: inviteRole,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to send invitation.');
    } else {
      setInviteEmail('');
      setNotice('Invitation saved successfully.');
      await load();
    }
    setPendingActionId(null);
  };

  const activeCount = useMemo(
    () => members.filter((member) => member.membershipStatus === 'active').length,
    [members]
  );
  const invitedCount = useMemo(
    () => members.filter((member) => member.membershipStatus === 'invited').length,
    [members]
  );
  const adminCount = useMemo(
    () => members.filter((member) => ['owner', 'admin'].includes(member.role)).length,
    [members]
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer administration"
        title="Team"
        description="Manage team invitations, access roles and membership status using server-authorised company-scoped actions."
        actions={
          <ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </ActionButton>
        }
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Active members" value={activeCount} tone="green" />
        <KpiCard label="Invited" value={invitedCount} tone="orange" />
        <KpiCard label="Owners / admins" value={adminCount} tone="navy" />
      </KpiGrid>

      {canManageTeam && (
        <Panel title="Invite member" style={{ marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="email@company.com"
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.5rem 0.65rem',
                minWidth: '220px',
                fontSize: '0.78rem',
              }}
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as 'admin' | 'dispatcher' | 'viewer')}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.5rem 0.65rem',
                fontSize: '0.78rem',
                background: '#fff',
              }}
            >
              <option value="viewer">viewer</option>
              <option value="dispatcher">dispatcher</option>
              <option value="admin">admin</option>
            </select>
            <ActionButton
              tone="primary"
              disabled={pendingActionId === 'invite'}
              onClick={() => void sendInvite()}
            >
              {pendingActionId === 'invite' ? 'Inviting…' : 'Invite member'}
            </ActionButton>
          </div>
        </Panel>
      )}

      <Panel
        title="Company team"
        description="Only memberships belonging to the active customer company are returned."
      >
        <DataTable
          columns={['Member', 'Email', 'Phone', 'Role', 'Membership', 'Profile', 'Joined', 'Actions']}
          rows={members.map((member) => [
            <strong key="member">
              {member.fullName?.trim() || member.email || 'Company member'}
              {member.isCurrentUser ? ' (you)' : ''}
            </strong>,
            member.email ?? 'Not recorded',
            member.phone ?? 'Not recorded',
            member.role.replace(/_/g, ' '),
            <StatusBadge key="membership" value={member.membershipStatus} />,
            <StatusBadge
              key="profile"
              value={member.profileStatus ?? (member.userId ? 'profile unavailable' : 'invited')}
              tone={member.profileStatus === 'active' ? 'green' : 'grey'}
            />,
            formatDate(member.createdAt),
            canManageTeam && !member.isCurrentUser ? (
              <div key="actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <select
                    defaultValue={member.role}
                    onChange={(event) => {
                      const nextRole = event.target.value as TeamMember['role'];
                      if (nextRole === member.role) return;
                      setPendingActionId(member.id);
                      void runTeamAction(
                        { membershipId: member.id, action: 'role', role: nextRole },
                        'Role updated.'
                      ).finally(() => setPendingActionId(null));
                    }}
                    disabled={pendingActionId === member.id}
                    style={{ fontSize: '0.7rem' }}
                  >
                    {ROLE_OPTIONS.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>
                        {roleOption}
                      </option>
                    ))}
                  </select>
                  {member.membershipStatus === 'suspended' ? (
                    <button
                      type="button"
                      disabled={pendingActionId === member.id}
                      onClick={() => {
                        setPendingActionId(member.id);
                        void runTeamAction(
                          { membershipId: member.id, action: 'reactivate' },
                          'Member reactivated.'
                        ).finally(() => setPendingActionId(null));
                      }}
                      style={{ fontSize: '0.68rem' }}
                    >
                      Reactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pendingActionId === member.id}
                      onClick={() => {
                        setPendingActionId(member.id);
                        void runTeamAction(
                          { membershipId: member.id, action: 'suspend' },
                          'Member suspended.'
                        ).finally(() => setPendingActionId(null));
                      }}
                      style={{ fontSize: '0.68rem' }}
                    >
                      Suspend
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pendingActionId === member.id}
                  onClick={() => {
                    if (!window.confirm('Remove this member from the company team?')) return;
                    setPendingActionId(member.id);
                    void runTeamAction(
                      { membershipId: member.id, action: 'remove' },
                      'Member removed.'
                    ).finally(() => setPendingActionId(null));
                  }}
                  style={{ fontSize: '0.68rem' }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <span key="actions" style={{ color: '#64748b', fontSize: '0.68rem' }}>
                {canManageTeam ? 'Self-managed' : 'Read only'}
              </span>
            ),
          ])}
          empty={<EmptyState title={loading ? 'Loading team…' : 'No team members found'} />}
        />
      </Panel>
    </PageFrame>
  );
}
