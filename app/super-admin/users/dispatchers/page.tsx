'use client';

import SuperAdminUserListPage, { statusDot, fmt } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon="🧭"
      title="Dispatchers"
      description="All dispatcher accounts and the companies they operate within."
      section="Users"
      roleFilter="dispatcher"
      columns={[
        { label: 'Name', render: (row) => <strong>{row.name}</strong> },
        { label: 'Email', render: (row) => <span style={{ color: '#94a3b8' }}>{row.email}</span> },
        { label: 'Company', render: (row) => row.company ?? '—' },
        { label: 'Company status', render: (row) => statusDot(row.status) },
        { label: 'Joined', render: (row) => <span style={{ color: '#94a3b8' }}>{fmt(row.created_at)}</span> },
      ]}
    />
  );
}
