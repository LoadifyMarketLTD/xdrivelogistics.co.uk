'use client';

import SuperAdminUserListPage, { statusDot, fmt } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon="🛡️"
      title="Platform Administrators"
      description="All accounts with platform owner role and super-admin access."
      section="Users"
      roleFilter="platform_admin"
      columns={[
        { label: 'Name / display', render: (row) => <strong>{row.name}</strong> },
        { label: 'Email', render: (row) => <span style={{ color: '#94a3b8' }}>{row.email}</span> },
        { label: 'Role', render: (row) => <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.75rem' }}>{row.role}</span> },
        { label: 'Status', render: (row) => statusDot(row.status ?? 'active') },
        { label: 'Joined', render: (row) => <span style={{ color: '#94a3b8' }}>{fmt(row.created_at)}</span> },
      ]}
    />
  );
}
