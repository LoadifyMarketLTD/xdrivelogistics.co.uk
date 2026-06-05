'use client';

import SuperAdminModulePage from '@/app/super-admin/_components/SuperAdminModulePage';

export default function Page() {
  return (
    <SuperAdminModulePage
      icon="🟢"
      title="Active Companies"
      description="Currently active and approved companies across platform."
      section="Companies"
    />
  );
}
