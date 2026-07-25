'use client';

import SuperAdminUserListPage, { statusDot, fmt } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon="🚗"
      title="Drivers"
      description="Platform-wide driver accounts, availability and app access status."
      section="Users"
      roleFilter="driver"
      columns={[
        { label: 'Name', render: (row) => <strong>{row.name}</strong> },
        { label: 'Email', render: (row) => <span style={{ color: '#94a3b8' }}>{row.email}</span> },
        { label: 'Phone', render: (row) => <span style={{ color: '#94a3b8' }}>{row.phone ?? '—'}</span> },
        { label: 'Company', render: (row) => row.company ?? '—' },
        { label: 'Status', render: (row) => statusDot(row.status) },
        { label: 'Availability', render: (row) => statusDot(row.availability_status) },
        {
          label: 'App access',
          render: (row) => (
            <span style={{ color: row.app_access ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>
              {row.app_access ? 'Enabled' : 'Disabled'}
            </span>
          ),
        },
        { label: 'Joined', render: (row) => <span style={{ color: '#94a3b8' }}>{fmt(row.created_at)}</span> },
      ]}
    />
  );
}

