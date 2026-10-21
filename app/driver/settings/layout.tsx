import type { ReactNode } from 'react';
import { WorkspaceRouteTabs } from '@/app/components/workspace/WorkspaceUI';

export default function DriverSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkspaceRouteTabs
        ariaLabel="Account settings"
        items={[
          { href: '/driver/settings', label: 'Settings' },
          { href: '/driver/account/legal-agreements', label: 'Legal & Agreements' },
        ]}
      />
      {children}
    </>
  );
}
