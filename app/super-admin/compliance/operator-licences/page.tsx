'use client';

import { useState } from 'react';
import Link from 'next/link';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import ComplianceRequestUpdateButton from '@/app/super-admin/compliance/_components/ComplianceRequestUpdateButton';
import { StatusChip } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  entity_type: 'driver' | 'vehicle' | 'company';
  entity_name: string;
  company_name: string;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  issued_date: string | null;
  is_expired: boolean;
};

const actionStyle = {
  minHeight: '40px',
  padding: '24px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#1D57D8',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '14px',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export default function Page() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <SuperAdminLiveTablePage<Row>
      icon="📋"
      title="Operator Licences"
      sectionLabel="Compliance"
      description="Operator licence status across all companies — regulator readiness overview."
      endpoint="/api/super-admin/compliance?section=operator-licences&limit=250"
      summaryField="summary"
      refreshKey={refreshKey}
      emptyMessage="No operator licence documents found."
      columns={[
        {
          key: 'entity',
          label: 'Entity',
          render: (row) => (
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{row.entity_name}</div>
              <div style={{ fontSize: '0.68rem', color: '#667085' }}>{row.entity_type}</div>
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
          label: 'Licence Type',
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
            <span style={{ fontSize: '0.75rem', color: row.is_expired ? '#D92D20' : '#667085' }}>
              {row.expiry_date ?? '—'}{row.is_expired ? ' · EXPIRED' : ''}
            </span>
          ),
        },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/super-admin/compliance/documents" style={actionStyle}>Review docs</Link>
              <ComplianceRequestUpdateButton
                documentFamily={row.entity_type}
                documentId={row.id}
                onUpdated={() => setRefreshKey((value) => value + 1)}
              />
            </div>
          ),
        },
      ]}
    />
  );
}
