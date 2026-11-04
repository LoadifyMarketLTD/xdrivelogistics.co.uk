'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { adminMasterTab } from '../../lib/masterWorkspaceRouteTab';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';
import ProtectedRoute from '../components/ProtectedRoute';

export default function Company3150LayoutGate({children}:{children:ReactNode}) {
  const pathname=usePathname();
  if(pathname==='/admin') return <>{children}</>;
  return <ProtectedRoute><MasterWorkspace
    role="Company / Carrier" authenticated initialTab={adminMasterTab(pathname)} dashboard={children}
  /></ProtectedRoute>;
}
