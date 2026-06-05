'use client';

import SuperAdminModulePage from '@/app/super-admin/_components/SuperAdminModulePage';

export default function Page() {
  return (
    <SuperAdminModulePage
      icon="🚫"
      title="Suspended Companies"
      description="Suspended companies and reinstatement tracking."
      section="Companies"
    />
  );
}
