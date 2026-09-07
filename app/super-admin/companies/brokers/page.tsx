'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  name: string;
  company_number: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
  memberships_total: number;
  memberships_active: number;
  jobs_total: number;
  jobs_open: number;
  jobs_delivered: number;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="◎"
    title="Broker Oversight"
    sectionLabel="Companies"
    description="Platform-level broker company oversight without entering or impersonating the broker tenant workspace."
    endpoint="/api/super-admin/brokers"
    pageSize={50}
    emptyMessage="No broker companies found."
    columns={[
      { key: 'broker', label: 'Broker', render: (row) => <div><PlatformEntityLink entityType="company" entityId={row.id} compact>{row.name}</PlatformEntityLink><div style={{fontSize:10,color:'#64748B',marginTop:3}}>{row.company_number ?? 'No company number'} · {row.email ?? 'No email'}</div></div> },
      { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
      { key: 'members', label: 'Members', render: (row) => <span>{row.memberships_active} active / {row.memberships_total} total</span> },
      { key: 'jobs', label: 'Jobs', render: (row) => <span>{row.jobs_open} open · {row.jobs_delivered} delivered · {row.jobs_total} total</span> },
      { key: 'joined', label: 'Registered', render: (row) => formatDateTime(row.created_at) },
      { key: 'inspect', label: 'Inspect', render: (row) => <PlatformEntityLink entityType="company" entityId={row.id} compact>Open company</PlatformEntityLink> },
    ]}
  />;
}
