'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  role: string;
  source: string;
  total_members: number;
  active_members: number;
  invited_members: number;
  suspended_members: number;
  last_updated_at: string | null;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🔐"
      title="Roles & Permissions"
      sectionLabel="Settings"
      description="Runtime RBAC role visibility from profiles and company_memberships."
      endpoint="/api/super-admin/settings?section=roles-permissions"
      summaryField="summary"
      noteField="note"
      emptyMessage="No runtime RBAC role data found."
      columns={[
        {
          key: 'role',
          label: 'Role',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 700, fontFamily: 'monospace' }}>
              {row.role}
            </span>
          ),
        },
        {
          key: 'source',
          label: 'Source',
          render: (row) => <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{row.source}</span>,
        },
        {
          key: 'total_members',
          label: 'Total',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.total_members.toLocaleString()}</span>,
        },
        {
          key: 'active_members',
          label: 'Active',
          render: (row) => <span style={{ fontSize: '0.78rem', color: '#22c55e' }}>{row.active_members.toLocaleString()}</span>,
        },
        {
          key: 'invited_members',
          label: 'Invited',
          render: (row) => <span style={{ fontSize: '0.78rem', color: '#f59e0b' }}>{row.invited_members.toLocaleString()}</span>,
        },
        {
          key: 'suspended_members',
          label: 'Suspended',
          render: (row) => <span style={{ fontSize: '0.78rem', color: '#ef4444' }}>{row.suspended_members.toLocaleString()}</span>,
        },
        {
          key: 'last_updated_at',
          label: 'Last Updated',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {row.last_updated_at ? formatDateTime(row.last_updated_at) : '—'}
            </span>
          ),
        },
      ]}
    />
  );
}
