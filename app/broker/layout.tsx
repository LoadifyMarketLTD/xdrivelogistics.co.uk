import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceShell from '../components/workspace/WorkspaceShell';

export const metadata: Metadata = { title: 'Broker Workspace | XDrive Logistics', description: 'Customer loads, carrier sourcing, awards, operations and margin.', robots: { index: false, follow: false } };
export default function BrokerLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute allowedRoles={['broker','owner']}><WorkspaceShell forcedRole="broker">{children}</WorkspaceShell></ProtectedRoute>;
}
