'use client';

import SuperAdminModulePage from '@/app/super-admin/_components/SuperAdminModulePage';

export default function Page() {
  return (
    <SuperAdminModulePage
      icon="🩺"
      title="Platform Health"
      description="Runtime health view for APIs, queues, and critical services."
      section="Platform"
    />
  );
}
