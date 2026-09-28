'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  entity_type: string;
  entity_name: string;
  company_name: string;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  is_expired: boolean;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="fleet-compliance"
    title="Fleet Compliance Status"
    sectionLabel="Fleet"
    description="Driver and vehicle compliance evidence across the platform. This view reports persisted document state only and does not invent mechanical maintenance health."
    endpoint="/api/super-admin/compliance?section=documents"
    pageSize={50}
    emptyMessage="No fleet compliance evidence found."
    columns={[
      { key: 'resource', label: 'Resource', render: (row) => <div><strong>{row.entity_name}</strong><div>{row.entity_type}</div></div> },
      { key: 'company', label: 'Company', render: (row) => row.company_name },
      { key: 'document', label: 'Evidence', render: (row) => row.doc_type },
      { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.is_expired ? 'expired' : row.status} /> },
      { key: 'expiry', label: 'Expiry', render: (row) => formatDateTime(row.expiry_date) },
    ]}
  />;
}
