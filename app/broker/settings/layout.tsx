import type { ReactNode } from 'react';
import { WorkspaceRouteTabs } from '@/app/components/workspace/WorkspaceUI';

export default function BrokerSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkspaceRouteTabs
        ariaLabel="Account settings"
        items={[
          { href: '/broker/settings', label: 'Settings' },
          { href: '/broker/account/legal-agreements', label: 'Legal & Agreements' },
        ]}
      />
      {children}
    </>
  );
}
