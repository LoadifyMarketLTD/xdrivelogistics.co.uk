'use client';

import { Building2 } from 'lucide-react';
import SuperAdminUserListPage, { statusDot, fmt } from '@/app/super-admin/_components/SuperAdminUserListPage';

export default function Page() {
  return (
    <SuperAdminUserListPage
      icon={<Building2 size={20} aria-hidden="true" />}
      title="Company Owners"
      description="All company owner accounts and the companies they administer."
      section="Users"
      roleFilter="owner"
      columns={[
        { label: 'Name / email', render: (row) => <strong>{row.name}</strong> },
        { label: 'Company', render: (row) => row.company ?? '?' },
        { label: 'Company status', render: (row) => statusDot(row.status) },
        { label: 'Role', render: () => <strong>company_owner</strong> },
        { label: 'Joined', render: (row) => fmt(row.created_at) },
      ]}
    />
  );
}
