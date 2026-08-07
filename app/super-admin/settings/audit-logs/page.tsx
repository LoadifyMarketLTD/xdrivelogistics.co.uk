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
    // Canonical company governance types (set by companies/[id]/route.ts)
    company_approved: '✅ Approved',
    company_rejected: '❌ Rejected',
    company_suspended: '🔒 Suspended',
    company_reinstated: '🔓 Reinstated',
    // Marketplace governance types (set by marketplace/[id]/route.ts via RPC)
    marketplace_published: '📤 Published',
    marketplace_hidden: '📥 Hidden',
    marketplace_job_disputed: '⚖️ Dispute',
    marketplace_job_cancelled: '🚫 Cancelled',
    // Legacy aliases (kept for backward compat with older audit rows)
    publish_to_exchange: '📤 Published',
    hide_from_exchange: '📥 Hidden',
    force_dispute: '⚖️ Dispute',
    force_cancel: '🚫 Cancelled',
    // Document compliance types (set by compliance/route.ts)
    document_approved: '📄 Doc Approved',
    document_rejected: '📄 Doc Rejected',
    document_viewed: '👁️ Doc Viewed',
    // Support types (set by support/route.ts)
    support_ticket_updated: '🎫 Ticket Updated',
    // Onboarding types (set by onboarding/[id]/route.ts)
    onboarding_submitted: '📋 Onboarding Submitted',
    onboarding_invite: '✉️ Onboarding Invite Sent',
    onboarding_invite_resent: '✉️ Invite Resent',
    invite_sent: '✉️ Invite Sent',
    // Driver / user management types
    driver_created: '🚗 Driver Created',
    existing_driver_updated: '🚗 Driver Updated',
    temporary_password_created: '🔑 Temp Password Created',
    // POD / job types
    pod_generated: '📦 POD Generated',
    // Fraud / identity review types
    fraud_case: '🚨 Fraud Case',
    identity: '🪪 Identity Review',
  };

  if (labels[action]) return labels[action];

  // Catch-all: convert snake_case to Title Case for any unknown action types
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {row.old_status} → {row.new_status}
            </span>
          ),
        },
        {
          key: 'reason',
          label: 'Reason',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{row.reason}</span>
          ),
        },
      ]}
    />
  );
}
