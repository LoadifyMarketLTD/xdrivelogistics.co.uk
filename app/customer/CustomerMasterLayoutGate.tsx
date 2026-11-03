'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';

export default function CustomerMasterLayoutGate({ children }: {children:ReactNode}) {
  const pathname=usePathname();
  return pathname==='/customer' ? <>{children}</> :
    <TopWorkspaceShell forcedRole="customer">{children}</TopWorkspaceShell>;
}
