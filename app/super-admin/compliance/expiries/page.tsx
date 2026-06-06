'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  entity_type: string;
  entity_name: string;
  company_name: string;
  doc_type: string;
  status: string;
  expiry_date: string;
  days_until_expiry: number;
  is_expired: boolean;
  expires_soon: boolean;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="⏰"
      title="Expiry Tracking"
      sectionLabel="Compliance"
      description="Upcoming and overdue document expiries across all companies — sorted by earliest expiry."
      endpoint="/api/super-admin/compliance?section=expiries&limit=250"
      summaryField="summary"
      emptyMessage="No document expiry records found."
      columns={[
        {
          key: 'entity',
          label: 'Owner',
          render: (row) => (
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{row.entity_name}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{row.entity_type}</div>
            </div>
          ),
        },
        {
          key: 'company',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span>,
        },
        {
          key: 'doc_type',
          label: 'Document',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.doc_type}</span>,
        },
        {
          key: 'status',
          label: 'Doc Status',
          render: (row) => <StatusChip status={row.status} />,
        },
        {
          key: 'expiry_date',
          label: 'Expiry Date',
          render: (row) => (
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: row.is_expired ? '#ef4444' : row.expires_soon ? '#f59e0b' : '#f1f5f9' }}>
              {row.expiry_date}
            </span>
          ),
        },
        {
          key: 'days_until_expiry',
          label: 'Days',
          render: (row) => (
            <span style={{
              fontSize: '0.8rem', fontWeight: 700,
              color: row.is_expired ? '#ef4444' : row.days_until_expiry <= 7 ? '#ef4444' : row.days_until_expiry <= 30 ? '#f59e0b' : '#22c55e',
            }}>
              {row.is_expired ? `${Math.abs(row.days_until_expiry)}d ago` : `${row.days_until_expiry}d`}
            </span>
          ),
        },
      ]}
    />
  );
}
