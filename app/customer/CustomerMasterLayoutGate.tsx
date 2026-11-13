'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import AuthenticatedMasterShell from '../components/workspace/AuthenticatedMasterShell';
import { customerMasterTab } from '../../lib/masterWorkspaceRouteTab';

// Keep the same sidebar instance mounted across Dashboard and every Customer route.
// The former Dashboard-only shell caused a full sidebar unmount on each transition.
export default function CustomerMasterLayoutGate({ children }: {children: ReactNode}) {
  const pathname = usePathname();
  return <AuthenticatedMasterShell role="Customer" activeTab={customerMasterTab(pathname)}>{children}</AuthenticatedMasterShell>;
}
