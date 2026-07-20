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
  role: string;
  membershipStatus: string;
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

export default function CustomerTeamPage() {
  const workspace = useCompanyWorkspaceData();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!workspace.companyId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setError('Your session has expired. Please sign in again.');
      setMembers([]);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ companyId: workspace.companyId });
    const response = await fetch(`/api/customer/team?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      members?: TeamMember[];
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? 'Unable to load the company team.');
      setMembers([]);
    } else {
      setMembers(Array.isArray(payload.members) ? payload.members : []);
    }

    setLoading(false);
  }, [workspace.companyId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        description="Company members are loaded through a server-authorised, company-scoped roster instead of direct browser access to other users' profiles."
        actions={
          <ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </ActionButton>
        }
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Active members" value={activeCount} tone="green" />
        <KpiCard label="Invited" value={invitedCount} tone="orange" />
        <KpiCard label="Owners / admins" value={adminCount} tone="navy" />
      </KpiGrid>

      <Panel
        title="Company team"
        description="Only memberships belonging to the active customer company are returned."
      >
        <DataTable
          columns={['Member', 'Email', 'Phone', 'Role', 'Membership', 'Profile', 'Joined']}
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
          ])}
          empty={
            <EmptyState title={loading ? 'Loading team…' : 'No team members found'} />
          }
        />
      </Panel>

      {!loading && members.length > 0 && (
        <Panel title="Team management boundary" style={{ marginTop: '0.9rem' }}>
          <p
            style={{
              margin: 0,
              color: '#64748b',
              fontSize: '0.78rem',
              lineHeight: 1.55,
            }}
          >
            This page reports the real roster. Invitations, suspensions and role changes
            remain unavailable until dedicated server-authorised write endpoints and audit
            events are implemented.
          </p>
        </Panel>
      )}
    </PageFrame>
  );
}
