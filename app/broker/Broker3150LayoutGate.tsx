'use client';
import type {ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';
import ProtectedRoute from '../components/ProtectedRoute';

import {brokerMasterTab} from '../../lib/masterWorkspaceRouteTab';

/**
 * Preserve existing, secured Broker page actions inside the common XDrive shell.
 * The route remains authoritative and the Master tab reflects its section.
 */
export default function Broker3150LayoutGate({children}:{children:ReactNode}){
 const pathname=usePathname();
 if(pathname==='/broker')return <>{children}</>;
 return <ProtectedRoute><MasterWorkspace role="Broker" authenticated initialTab={brokerMasterTab(pathname)} dashboard={children}/></ProtectedRoute>;
}
