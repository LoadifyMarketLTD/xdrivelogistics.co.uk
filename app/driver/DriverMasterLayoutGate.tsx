'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import DriverTopWorkspaceShell from './_components/DriverTopWorkspaceShell';

export default function DriverMasterLayoutGate({ children }: {children:ReactNode}) {
  const pathname=usePathname();
  return pathname==='/driver' ? <>{children}</> :
    <DriverTopWorkspaceShell>{children}</DriverTopWorkspaceShell>;
}
