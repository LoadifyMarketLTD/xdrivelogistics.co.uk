'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {useAuth} from '../components/AuthContext';
import {resolveWorkspaceRole} from '../../lib/workspaceRole';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';

/** The same role resolution is applied to the dashboard and every deep link. */
export default function DriverMasterLayoutGate({children}:{children:ReactNode}){
 const pathname=usePathname();
 const {user}=useAuth();
 const workspace=resolveWorkspaceRole(user);
 const driverRole=String(user?.driverType??user?.rawRole??'').toLowerCase();
 const role=workspace==='owner_driver'?'Owner Driver':driverRole==='company_driver'?'Company Driver':'Driver';
 if(pathname==='/driver')return <>{children}</>;
 const section=pathname.split('/')[2]||'';
 const tabs:Record<string,number>={'post-load':1,loads:2,quotes:3,jobs:4,vehicles:5,documents:6,history:7,finance:8,nearby:9,directory:10,availability:11,returns:12,'freight-vision':13,messages:14,notifications:15};
 return <MasterWorkspace role={role} authenticated initialTab={tabs[section]??0} dashboard={children}/>;
}
