'use client';

import SuperAdminUserListPage, { fmt, statusDot } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon="🛡️"
      title="Platform Administrators"
      description="Authoritative Platform Owner registry resolved from owner profiles and Supabase Auth identity. Role mutation remains separately governed."
      section="Platform"
      roleFilter="platform_admin"
      columns={[
        { label: 'Name', render: (row) => <strong>{row.name}</strong> },
        { label: 'Email', render: (row) => <span style={{ color: '#64748B' }}>{row.email}</span> },
        { label: 'Authority', render: () => <span style={{ color: '#0B2F6B', fontWeight: 800 }}>Platform Owner</span> },
        { label: 'Status', render: (row) => statusDot(row.status) },
        { label: 'Created', render: (row) => <span style={{ color: '#64748B' }}>{fmt(row.created_at)}</span> },
      ]}
    />
  );
}
