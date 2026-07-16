'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_name: string;
  target_company_id: string;
  action_type: string;
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
};

const actionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    approve_company: '✅ Approved',
    reject_company: '❌ Rejected',
    suspend_company: '🔒 Suspended',
    reinstate_company: '🔓 Reinstated',
    publish_to_exchange: '📤 Published',
    hide_from_exchange: '📥 Hidden',
    force_dispute: '⚖️ Dispute',
    force_cancel: '🚫 Cancelled',
  };
  return labels[action] ?? action;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="📚"
      title="Audit Logs"
      sectionLabel="Settings"
      description="Immutable platform administration audit trail — all owner governance actions."
      endpoint="/api/super-admin/audit?limit=250"
      summaryField="summary"
      emptyMessage="No audit log entries found."
      columns={[
        {
          key: 'created_at',
          label: 'Timestamp',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</span>
          ),
        },
        {
          key: 'action_type',
          label: 'Action',
          render: (row) => (
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{actionLabel(row.action_type)}</span>
          ),
        },
        {
          key: 'company',
          label: 'Target Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span>,
        },
        {
          key: 'transition',
          label: 'Status Change',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#0B2F6B' }}>
              {row.old_status} → {row.new_status}
            </span>
          ),
        },
        {
          key: 'reason',
          label: 'Reason',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#0B2F6B' }}>{row.reason}</span>
          ),
        },
      ]}
    />
  );
}
