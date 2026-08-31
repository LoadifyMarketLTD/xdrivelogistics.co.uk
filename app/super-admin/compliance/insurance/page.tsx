'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  entity_type: 'driver' | 'vehicle';
  entity_id: string;
  entity_name: string;
  company_name: string;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  issued_date: string | null;
  is_expired: boolean;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🛡️"
      title="Insurance Monitoring"
      sectionLabel="Compliance"
      description="Insurance document validity, exceptions, and risk indicators across all entities."
      endpoint="/api/super-admin/compliance?section=insurance&limit=250"
      summaryField="summary"
      emptyMessage="No insurance documents found."
      entityLink={(row) => row.entity_id
        ? { entityType: row.entity_type, entityId: row.entity_id, label: `${row.entity_type === 'driver' ? 'Driver' : 'Vehicle'} Inspector` }
        : null}
      columns={[
        {
          key: 'entity',
          label: 'Entity',
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
          label: 'Insurance Type',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.doc_type}</span>,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'issued_date',
          label: 'Issued',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.issued_date ?? '—'}</span>,
        },
        {
          key: 'expiry_date',
          label: 'Expires',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: row.is_expired ? '#ef4444' : '#f1f5f9' }}>
              {row.expiry_date ?? '—'}{row.is_expired ? ' ⚠️ EXPIRED' : ''}
            </span>
          ),
        },
      ]}
    />
  );
}
