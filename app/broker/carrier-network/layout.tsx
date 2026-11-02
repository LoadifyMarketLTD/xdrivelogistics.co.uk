import type { ReactNode } from 'react';
import { WorkspaceRouteTabs } from '@/app/components/workspace/WorkspaceUI';

export default function BrokerCarrierNetworkLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkspaceRouteTabs
        ariaLabel="Broker carrier network views"
        items={[
          { href: '/broker/carrier-network', label: 'Carriers' },
          { href: '/broker/carrier-network/directory', label: 'Directory' },
        ]}
        note="Carriers = broker relationships · Directory = XDrive member network"
      />
      {children}
    </>
  );
}
