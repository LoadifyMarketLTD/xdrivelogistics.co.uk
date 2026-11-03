'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';

export default function DriverMasterLayoutGate({ children }: {children:ReactNode}) {
  const pathname=usePathname();
  if(pathname==='/driver') return <>{children}</>;
  const section=pathname.split('/')[2]||'';
  const tabs:Record<string,number>={'post-load':1,loads:2,quotes:3,jobs:4,vehicles:5,documents:6,history:7,finance:8,nearby:9,directory:10,availability:11,returns:12,messages:14,notifications:15};
  return <MasterWorkspace role="Driver" authenticated initialTab={tabs[section]??0} dashboard={children}/>;
}
