'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import AuthenticatedMasterShell from '../components/workspace/AuthenticatedMasterShell';
import {customerMasterTab} from '../../lib/masterWorkspaceRouteTab';

export default function CustomerMasterLayoutGate({ children }: {children:ReactNode}) {
  const pathname=usePathname();
  if(pathname==='/customer') return <>{children}</>;
  return <AuthenticatedMasterShell role="Customer" activeTab={customerMasterTab(pathname)}>{children}</AuthenticatedMasterShell>;
}
