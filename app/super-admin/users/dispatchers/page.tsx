'use client';

import { Navigation } from 'lucide-react';
import SuperAdminUserListPage, { statusDot, fmt } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon={<Navigation size={20} aria-hidden="true" />}
      title="Dispatchers"
      description="All dispatcher accounts and the companies they operate within."
      section="Users"
      roleFilter="dispatcher"
      columns={[
        { label: 'Name', render: (row) => <strong>{row.name}</strong> },
        { label: 'Email', render: (row) => row.email },
        { label: 'Company', render: (row) => row.company ?? '?' },
        { label: 'Company status', render: (row) => statusDot(row.status) },
        { label: 'Joined', render: (row) => fmt(row.created_at) },
      ]}
    />
  );
}
