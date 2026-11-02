import type { ReactNode } from 'react';
import { WorkspaceRouteTabs } from '@/app/components/workspace/WorkspaceUI';

export default function CustomerSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkspaceRouteTabs
        ariaLabel="Account settings"
        items={[
          { href: '/customer/settings', label: 'Settings' },
          { href: '/customer/account/legal-agreements', label: 'Legal & Agreements' },
        ]}
      />
      {children}
    </>
  );
}
