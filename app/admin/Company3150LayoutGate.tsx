'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminPlatformShell from './AdminPlatformShell';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';
import { Company3150LiveProvider } from '../try-xdrive-demo/components/Company3150LiveData';
export default function Company3150LayoutGate({children}:{children:ReactNode}) {
  const pathname=usePathname();
  if(pathname==='/admin') return <>{children}</>;
  if(/^\/admin\/jobs\/[^/]+$/.test(pathname)) {
    return <Company3150LiveProvider><MasterWorkspace role="Company / Carrier" authenticated initialTab={2} dashboard={children}/></Company3150LiveProvider>;
  }
  return <AdminPlatformShell>{children}</AdminPlatformShell>;
}
