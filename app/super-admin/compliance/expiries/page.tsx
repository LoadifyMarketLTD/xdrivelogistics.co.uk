'use client';

import SuperAdminModulePage from '@/app/super-admin/_components/SuperAdminModulePage';

export default function Page() {
  return (
    <SuperAdminModulePage
      icon="⏰"
      title="Expiry Tracking"
      description="Upcoming expiry timeline for all required documents."
      section="Compliance"
    />
  );
}
