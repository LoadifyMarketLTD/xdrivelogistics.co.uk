'use client';

import SuperAdminModulePage from '@/app/super-admin/_components/SuperAdminModulePage';

export default function Page() {
  return (
    <SuperAdminModulePage
      icon="✅"
      title="Approvals Queue"
      description="Company onboarding approvals awaiting platform review."
      section="Companies"
    />
  );
}
