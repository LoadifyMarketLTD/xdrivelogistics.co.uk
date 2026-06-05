'use client';

import SuperAdminModulePage from '@/app/super-admin/_components/SuperAdminModulePage';

export default function Page() {
  return (
    <SuperAdminModulePage
      icon="👥"
      title="All Users"
      description="All users across drivers, dispatchers, customers, and admins."
      section="Users"
    />
  );
}
