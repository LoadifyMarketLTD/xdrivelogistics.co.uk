'use client';

import SuperAdminModulePage from '@/app/super-admin/_components/SuperAdminModulePage';

export default function Page() {
  return (
    <SuperAdminModulePage
      icon="🔐"
      title="Roles & Permissions"
      description="Role model and permission matrix controls."
      section="Settings"
    />
  );
}
