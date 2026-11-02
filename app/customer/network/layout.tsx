import type { ReactNode } from 'react';
import { WorkspaceRouteTabs } from '@/app/components/workspace/WorkspaceUI';

export default function CustomerNetworkLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkspaceRouteTabs
        ariaLabel="Customer network views"
        items={[
          { href: '/customer/network', label: 'Companies' },
          { href: '/customer/network/directory', label: 'Directory' },
        ]}
        note="Companies = your relationships · Directory = XDrive member network"
      />
      {children}
    </>
  );
}
