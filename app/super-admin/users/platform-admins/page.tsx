'use client';

import { ShieldCheck } from 'lucide-react';
import SuperAdminUserListPage, { fmt, statusDot } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon={<ShieldCheck size={20} aria-hidden="true" />}
      title="Platform Administrators"
      description="Authoritative Platform Owner registry resolved from owner profiles and Supabase Auth identity. Role mutation remains separately governed."
      section="Platform"
      roleFilter="platform_admin"
      columns={[
        { label: 'Name', render: (row) => <strong>{row.name}</strong> },
        { label: 'Email', render: (row) => row.email },
        { label: 'Authority', render: () => <strong>Platform Owner</strong> },
        { label: 'Status', render: (row) => statusDot(row.status) },
        { label: 'Created', render: (row) => fmt(row.created_at) },
      ]}
    />
  );
}
