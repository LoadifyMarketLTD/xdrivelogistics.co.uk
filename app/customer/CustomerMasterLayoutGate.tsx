'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';

export default function CustomerMasterLayoutGate({ children }: {children:ReactNode}) {
  const pathname=usePathname();
  if(pathname==='/customer') return <>{children}</>;
  const section=pathname.split('/')[2]||'';
  const tabs:Record<string,number>={'post-load':1,loads:2,quotes:3,bookings:4,diary:7,invoices:8,network:9,directory:10,'live-availability':11,messages:14,notifications:15};
  return <MasterWorkspace role="Customer" authenticated initialTab={tabs[section]??0} dashboard={children}/>;
}
