'use client';

import { UsersRound } from 'lucide-react';
import SuperAdminUserListPage, { statusDot, fmt } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon={<UsersRound size={20} aria-hidden="true" />}
      title="Customers"
      description="Customer accounts and their associated companies across the marketplace."
      section="Users"
      roleFilter="customer"
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
