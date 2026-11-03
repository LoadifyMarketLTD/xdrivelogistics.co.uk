'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminPlatformShell from './AdminPlatformShell';
export default function Company3150LayoutGate({children}:{children:ReactNode}) {
  const pathname=usePathname();
  if(pathname==='/admin') return <>{children}</>;
  return <AdminPlatformShell>{children}</AdminPlatformShell>;
}
