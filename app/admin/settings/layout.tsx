import type { ReactNode } from 'react';
import { WorkspaceRouteTabs } from '@/app/components/workspace/WorkspaceUI';

export default function AdminSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkspaceRouteTabs
        ariaLabel="Account settings"
        items={[
          { href: '/admin/settings', label: 'Settings' },
          { href: '/admin/settings/legal-agreements', label: 'Legal & Agreements' },
        ]}
      />
      {children}
    </>
  );
}
