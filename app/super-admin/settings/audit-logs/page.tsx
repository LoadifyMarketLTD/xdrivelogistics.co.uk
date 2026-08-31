'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import type { PlatformEntityType } from '@/app/super-admin/_components/control-plane';

type Row = {
  id: string;
  company_name: string | null;
  target_company_id: string | null;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  action_type: string;
  old_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: string;
};

const INSPECTOR_TARGET_TYPES: Record<string, PlatformEntityType> = {
  company: 'company',
  job: 'job',
  invoice: 'invoice',
  user: 'user',
  driver: 'driver',
  vehicle: 'vehicle',
  ticket: 'ticket',
  support_ticket: 'ticket',
  dispute: 'dispute',
  pod: 'pod',
  case: 'case',
};

const actionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    company_approved: '✅ Approved',
    company_rejected: '❌ Rejected',
    company_suspended: '🔒 Suspended',
    company_reinstated: '🔓 Reinstated',
    marketplace_published: '📤 Published',
    marketplace_hidden: '📥 Hidden',
    marketplace_job_disputed: '⚖️ Dispute',
    marketplace_job_cancelled: '🚫 Cancelled',
    publish_to_exchange: '📤 Published',
    hide_from_exchange: '📥 Hidden',
    force_dispute: '⚖️ Dispute',
    force_cancel: '🚫 Cancelled',
    document_approved: '📄 Doc Approved',
    document_rejected: '📄 Doc Rejected',
    document_viewed: '👁️ Doc Viewed',
    support_ticket_updated: '🎫 Ticket Updated',
    support_ticket_investigating: '🎫 Ticket Investigating',
    support_ticket_resolved: '✅ Ticket Resolved',
    support_ticket_closed: '🔒 Ticket Closed',
    support_ticket_reopened: '🔄 Ticket Reopened',
    onboarding_submitted: '📋 Onboarding Submitted',
    onboarding_invite: '✉️ Onboarding Invite Sent',
    onboarding_invite_resent: '✉️ Invite Resent',
    invite_sent: '✉️ Invite Sent',
    driver_created: '🚗 Driver Created',
    existing_driver_updated: '🚗 Driver Updated',
    temporary_password_created: '🔑 Temp Password Created',
    pod_generated: '📦 POD Generated',
    platform_pod_approve: '📦 Platform POD Approved',
    platform_pod_reject: '📦 Platform POD Rejected',
    platform_pod_request_missing: '📦 Missing POD Requested',
    platform_finance_reconciled: '£ Finance Reconciled',
    notification_retry_queued: '🔁 Notification Retry Queued',
    platform_feature_flag_updated: '🚩 Feature Flag Updated',
    platform_setting_updated: '⚙️ Platform Setting Updated',
    xdrive_enquiry_price_set: '£ XDrive Enquiry Priced',
    xdrive_enquiry_quote_sent: '✉️ XDrive Quote Sent',
    xdrive_enquiry_accepted: '✅ XDrive Quote Accepted',
    xdrive_enquiry_converted: '🚚 XDrive Enquiry Converted',
    fraud_case: '🚨 Fraud Case',
    identity: '🪪 Identity Review',
  };

  if (labels[action]) return labels[action];
  return action.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
      entityLink={(row) => {
        if (!row.target_id) return null;
        const entityType = INSPECTOR_TARGET_TYPES[String(row.target_type ?? '').toLowerCase()];
        if (!entityType) return null;
        return { entityType, entityId: row.target_id, label: 'Inspect target' };
      }}
      columns={[
        {
          key: 'created_at',
          label: 'Timestamp',
          render: (row) => <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</span>,
        },
        {
          key: 'action_type',
          label: 'Action',
          render: (row) => <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{actionLabel(row.action_type)}</span>,
        },
        {
          key: 'target',
          label: 'Target',
          render: (row) => (
            <div>
              <div style={{ fontSize: '0.78rem' }}>{row.target_name ?? row.company_name ?? 'Platform target'}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{row.target_type || 'unknown'}{row.target_id ? ` · ${row.target_id}` : ''}</div>
            </div>
          ),
        },
        {
          key: 'company',
          label: 'Company Boundary',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name ?? 'Platform / none'}</span>,
        },
        {
          key: 'transition',
          label: 'Status Change',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {row.old_status ?? '—'} → {row.new_status ?? '—'}
            </span>
          ),
        },
        {
          key: 'reason',
          label: 'Reason',
          render: (row) => <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{row.reason ?? '—'}</span>,
        },
      ]}
    />
  );
}