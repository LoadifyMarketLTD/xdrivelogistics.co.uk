import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/workspace-global-identity.css';
import '../components/workspace/top-workspace-shell.css';
import '../components/workspace/workspace-measured-cx-baseline.css';
import './broker-dashboard-convergence.css';

// Protected workspace documents receive a per-request CSP nonce from middleware.
// Force dynamic rendering so hard reloads and deep links receive matching nonces.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Broker Workspace | XDrive Logistics',
  description: 'Customer load management, carrier sourcing, awards, POD and broker finance.',
  robots: { index: false, follow: false },
};

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-measured xdrive-operational-top-workspace">
      <TopWorkspaceShell forcedRole="broker">{children}</TopWorkspaceShell>
    </div>
  );
}
