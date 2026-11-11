'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';

const DRIVER_MASTER_TAB_BY_ROUTE: Readonly<Record<string,number>> = {
 'post-load':1,loads:2,quotes:3,jobs:4,'won-work':4,reports:16,
 vehicles:5,fleet:5,drivers:6,history:7,finance:8,network:9,
 directory:10,availability:11,nearby:11,returns:12,'freight-vision':13,
 messages:14,notifications:15,documents:17,settings:18,profile:18,
 account:18,'change-password':18,
};

export default function DriverMasterLayoutGate({children}:{children:ReactNode}){
 const pathname=usePathname();
 const {user}=useAuth();
 if(pathname==='/driver')return <>{children}</>;
 const workspace=resolveWorkspaceRole(user);
 const role=workspace==='owner_driver'?'Owner Driver':'Company Driver';
 const section=pathname.split('/')[2]||'';
 return <MasterWorkspace key={pathname} role={role} authenticated
  initialTab={DRIVER_MASTER_TAB_BY_ROUTE[section]??0} dashboard={children}/>;
}
