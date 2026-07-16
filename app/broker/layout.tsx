import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { WorkspacePlatformShell } from '../components/workspace';

export const metadata: Metadata = {
  title: 'Broker Workspace | XDrive Logistics',
  description: 'Broker load publishing, bid management and award decisions.',
  robots: { index: false, follow: false },
};

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="authenticated-workspace">
      <WorkspacePlatformShell area="broker">{children}</WorkspacePlatformShell>
    </div>
  );
}
