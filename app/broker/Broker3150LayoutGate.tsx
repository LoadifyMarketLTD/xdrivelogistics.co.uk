'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import AuthenticatedMasterShell from '../components/workspace/AuthenticatedMasterShell';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';
import { brokerMasterTab } from '../../lib/masterWorkspaceRouteTab';

/** Preserve the approved Post Load route and the independently owned dashboard. */
export default function Broker3150LayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/broker') return <>{children}</>;
  if (pathname.startsWith('/broker/post-load')) {
    return <ProtectedRoute allowedRoles={['broker']}><MasterWorkspace role="Broker" authenticated initialTab={brokerMasterTab(pathname)} dashboard={children}/></ProtectedRoute>;
  }
  return (
    <ProtectedRoute allowedRoles={['broker']}>
      <AuthenticatedMasterShell role="Broker" activeTab={brokerMasterTab(pathname)}>
        {children}
      </AuthenticatedMasterShell>
    </ProtectedRoute>
  );
}
