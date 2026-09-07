'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_id: string | null;
  company_name: string;
  invoice_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="support"
    title="Support Disputes"
    sectionLabel="Support"
    description="Invoice dispute investigation with canonical company, invoice and dispute drill-down."
    endpoint="/api/super-admin/support?section=disputes"
    summaryField="summary"
    pageSize={50}
    emptyMessage="No disputes found."
    columns={[
      {
        key: 'dispute', label: 'Dispute',
        render: (row) => <PlatformEntityLink entityType="dispute" entityId={row.id} compact>Inspect dispute</PlatformEntityLink>,
      },
      {
        key: 'company', label: 'Company',
        render: (row) => row.company_id
          ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink>
          : row.company_name,
      },
      {
        key: 'invoice', label: 'Invoice',
        render: (row) => row.invoice_id
          ? <PlatformEntityLink entityType="invoice" entityId={row.invoice_id} compact>Inspect invoice</PlatformEntityLink>
          : '—',
      },
      { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
      { key: 'reason', label: 'Reason', render: (row) => row.reason },
      { key: 'details', label: 'Details', render: (row) => <span style={{ color: '#475569' }}>{row.details ?? '—'}</span> },
      { key: 'resolution', label: 'Resolution', render: (row) => <span style={{ color: row.resolution_note ? '#168553' : '#64748B' }}>{row.resolution_note ?? '—'}</span> },
      { key: 'filed', label: 'Filed', render: (row) => formatDateTime(row.created_at) },
      { key: 'resolved', label: 'Resolved', render: (row) => row.resolved_at ? formatDateTime(row.resolved_at) : '—' },
    ]}
  />;
}
