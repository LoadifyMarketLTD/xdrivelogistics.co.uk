import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Original3118WorkspaceShell from '../components/workspace/Original3118WorkspaceShell';

// Keep authenticated nonce-based pages dynamic and the production data/actions intact.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Broker Workspace | XDrive Logistics',
  description: 'Customer load management, carrier sourcing, awards, POD and broker finance.',
  robots: { index: false, follow: false },
};

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return <Original3118WorkspaceShell forcedRole="broker">{children}</Original3118WorkspaceShell>;
}
