'use client';

import Link from 'next/link';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  entity_type: string;
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
  border: '1px solid #E0E3E7',
  background: '#FFFFFF',
  color: '#1A73E8',
  fontFamily: 'Inter, Roboto, Arial, sans-serif',
  fontSize: '14px',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="📋"
      title="Operator Licences"
      sectionLabel="Compliance"
      description="Operator licence status across all companies — regulator readiness overview."
      endpoint="/api/super-admin/compliance?section=operator-licences&limit=250"
      summaryField="summary"
      emptyMessage="No operator licence documents found."
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
            <span style={{ fontSize: '0.75rem', color: row.is_expired ? '#ef4444' : '#f1f5f9' }}>
              {row.expiry_date ?? '—'}{row.is_expired ? ' ⚠️ EXPIRED' : ''}
            </span>
          ),
        },
        {
          key: 'actions',
          label: 'Actions',
          render: () => (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <Link href="/super-admin/compliance/documents" style={actionStyle}>Review docs</Link>
              <button type="button" aria-disabled="true" title="No governed request-update mutation is exposed by the current backend." style={{ ...actionStyle, cursor: 'not-allowed', opacity: 0.55 }}>Request update</button>
            </div>
          ),
        },
      ]}
    />
  );
}
