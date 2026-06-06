'use client';

import SuperAdminModulePage from '@/app/super-admin/_components/SuperAdminModulePage';

export default function Page() {
  return (
    <SuperAdminModulePage
      icon="🚩"
      title="Feature Flags"
      description="Feature rollout toggles and kill-switch controls."
      section="Settings"
    />
  );
}
