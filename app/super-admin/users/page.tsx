'use client';

import SuperAdminUserListPage, { statusDot, fmt } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon="👥"
      title="All Users"
      description="All platform profiles across every role — drivers, dispatchers, customers, owners and admins."
      section="Users"
      roleFilter=""
      columns={[
        { label: 'Name', render: (row) => <strong>{row.name}</strong> },
        { label: 'Email', render: (row) => <span style={{ color: '#94a3b8' }}>{row.email}</span> },
        {
          label: 'Role',
          render: (row) => (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                backgroundColor: '#0b1220',
                border: '1px solid #334155',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                color: '#94a3b8',
              }}
            >
              {row.role}
            </span>
          ),
        },
        { label: 'Status', render: (row) => statusDot(row.status ?? 'active') },
        { label: 'Joined', render: (row) => <span style={{ color: '#94a3b8' }}>{fmt(row.created_at)}</span> },
      ]}
    />
  );
}
