'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_id: string | null;
  user_id: string | null;
  company_name: string;
  user_name: string;
  user_email: string;
  role_in_company: string | null;
  status: string | null;
  profile_role: string | null;
  profile_status: string | null;
  created_at: string;
  updated_at: string;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="◎"
    title="Membership & Access"
    sectionLabel="Companies"
    description="Platform-wide company membership registry showing tenant authority separately from application profile role."
    endpoint="/api/super-admin/governance?section=memberships"
    pageSize={50}
    emptyMessage="No company memberships found."
    columns={[
      { key: 'company', label: 'Company', render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink> : '—' },
      { key: 'user', label: 'User', render: (row) => row.user_id ? <div><PlatformEntityLink entityType="user" entityId={row.user_id} compact>{row.user_name !== '—' ? row.user_name : row.user_email}</PlatformEntityLink><div style={{fontSize:10,color:'#64748B',marginTop:3}}>{row.user_email}</div></div> : <div><strong>Invited account</strong><div style={{fontSize:10,color:'#64748B',marginTop:3}}>{row.user_email}</div></div> },
      { key: 'tenant_role', label: 'Tenant role', render: (row) => <strong>{row.role_in_company?.replaceAll('_',' ') ?? '—'}</strong> },
      { key: 'membership_status', label: 'Membership', render: (row) => <StatusChip value={row.status} /> },
      { key: 'profile_role', label: 'Profile role', render: (row) => row.profile_role?.replaceAll('_',' ') ?? '—' },
      { key: 'profile_status', label: 'Profile status', render: (row) => row.profile_status ? <StatusChip value={row.profile_status} /> : '—' },
      { key: 'created', label: 'Created', render: (row) => formatDateTime(row.created_at) },
      { key: 'updated', label: 'Updated', render: (row) => formatDateTime(row.updated_at) },
    ]}
  />;
}
