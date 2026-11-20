'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import {useState} from 'react';
import Link from 'next/link';
import {DriverAvailabilityLiveWorkspace} from '../availability/live/DriverAvailabilityLiveWorkspace';
import CompanyAdminFleetRegister from '../../components/workspace/CompanyAdminFleetRegister';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import { useAuth } from '../../components/AuthContext';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
export default function DriverFleetPage(){
 const { user } = useAuth();
 const data = useCompanyWorkspaceData();
 const ownerWeb=resolveWorkspaceRole(user)==='owner_driver';
 const [view,setView]=useState<'register'|'live'>('register');
 return <ProtectedRoute allowedRoles={['driver']}>
  {ownerWeb&&<div className="workspace-tab-strip" aria-label="My Fleet tools" style={{display:"flex",flexWrap:"wrap",gap:6,padding:"8px 12px"}}><button type="button" aria-pressed={view==="register"} data-active={view==="register"} onClick={()=>setView("register")}>Fleet register</button><button type="button" aria-pressed={view==="live"} data-active={view==="live"} onClick={()=>setView("live")}>Current Position / Live</button><Link href="/driver/availability">Future Position</Link><Link href="/driver/returns">Future Journey</Link><Link href="/driver/notifications">Notifications</Link></div>}
  {ownerWeb&&view==="live"?<DriverAvailabilityLiveWorkspace mode="fleet"/>:<CompanyAdminFleetRegister data={data} driverWorkspace />}
 </ProtectedRoute>;
}
