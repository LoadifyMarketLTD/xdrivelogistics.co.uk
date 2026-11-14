'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import AuthenticatedMasterShell from '../components/workspace/AuthenticatedMasterShell';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';
import { adminMasterTab } from '../../lib/masterWorkspaceRouteTab';

/** Preserve the approved Post Load route and the independently owned dashboard. */
export default function Company3150LayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin') return <>{children}</>;
  if (pathname.startsWith('/admin/post-load')) {
    return <ProtectedRoute><MasterWorkspace role="Company / Carrier" authenticated initialTab={adminMasterTab(pathname)} dashboard={children}/></ProtectedRoute>;
  }
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <AuthenticatedMasterShell role="Company / Carrier" activeTab={adminMasterTab(pathname)}>
        {children}
      </AuthenticatedMasterShell>
    </ProtectedRoute>
  );
}
