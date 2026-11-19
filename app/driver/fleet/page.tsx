'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import {useState} from 'react';
import Link from 'next/link';
import {DriverAvailabilityLiveWorkspace} from '../availability/live/DriverAvailabilityLiveWorkspace';
import MemberFleetOverview from '../../components/workspace/MemberFleetOverview';
import { useAuth } from '../../components/AuthContext';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
export default function DriverFleetPage(){
 const { user } = useAuth();
 const ownerWeb=resolveWorkspaceRole(user)==='owner_driver';
 const [view,setView]=useState<'register'|'live'>('register');
 const canManage = resolveWorkspaceRole(user) === 'owner_driver' || (user?.role === 'driver' && user?.membershipRole?.toLowerCase() === 'owner');
 return <ProtectedRoute allowedRoles={['driver']}>
  {ownerWeb&&<div className="workspace-tab-strip" aria-label="My Fleet tools" style={{display:"flex",flexWrap:"wrap",gap:6,padding:"8px 12px"}}><button type="button" aria-pressed={view==="register"} data-active={view==="register"} onClick={()=>setView("register")}>Fleet register</button><button type="button" aria-pressed={view==="live"} data-active={view==="live"} onClick={()=>setView("live")}>Current Position / Live</button><Link href="/driver/availability">Future Position</Link><Link href="/driver/returns">Future Journey</Link><Link href="/driver/notifications">Notifications</Link></div>}
  {ownerWeb&&view==="live"?<DriverAvailabilityLiveWorkspace mode="fleet"/>:<MemberFleetOverview section="fleet" canManage={canManage} manageHref={canManage ? '/driver/vehicles' : undefined} />}
 </ProtectedRoute>;
}
