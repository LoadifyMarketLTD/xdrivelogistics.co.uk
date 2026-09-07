'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  actor_user_id: string | null;
  company_name: string;
  target_company_id: string | null;
  action_type: string;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: string;
};

const actionLabel = (action: string) => action
  .split('_')
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="audit"
    title="Audit Logs"
    sectionLabel="Platform"
    description="Immutable Platform Owner governance trail with canonical entity drill-down."
    endpoint="/api/super-admin/audit"
    summaryField="summary"
    pageSize={100}
    emptyMessage="No audit log entries found."
    columns={[
      { key: 'created_at', label: 'Timestamp', render: (row) => formatDateTime(row.created_at) },
      { key: 'action_type', label: 'Action', render: (row) => <strong>{actionLabel(row.action_type)}</strong> },
      {
        key: 'actor', label: 'Actor',
        render: (row) => row.actor_user_id
          ? <PlatformEntityLink entityType="user" entityId={row.actor_user_id} compact>Inspect actor</PlatformEntityLink>
          : 'Platform',
      },
      {
        key: 'company', label: 'Target Company',
        render: (row) => row.target_company_id
          ? <PlatformEntityLink entityType="company" entityId={row.target_company_id} compact>{row.company_name}</PlatformEntityLink>
          : row.company_name,
      },
      {
        key: 'transition', label: 'Status Change',
        render: (row) => <span style={{ color: '#667085' }}>{row.old_status ?? '—'} → {row.new_status ?? '—'}</span>,
      },
      { key: 'reason', label: 'Reason', render: (row) => <span style={{ color: '#667085' }}>{row.reason ?? '—'}</span> },
    ]}
  />;
}
