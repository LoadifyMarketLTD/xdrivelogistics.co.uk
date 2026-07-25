'use client';

import SuperAdminUserListPage, { statusDot, fmt } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon="🧑‍💼"
      title="Company Owners"
      description="All company owner accounts and the companies they administer."
      section="Users"
      roleFilter="owner"
      columns={[
        { label: 'Name / email', render: (row) => <strong>{row.name}</strong> },
        { label: 'Company', render: (row) => row.company ?? '—' },
        { label: 'Company status', render: (row) => statusDot(row.status) },
        { label: 'Role', render: (_row) => <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.75rem' }}>company_owner</span> },
        { label: 'Joined', render: (row) => <span style={{ color: '#94a3b8' }}>{fmt(row.created_at)}</span> },
      ]}
    />
  );
}
