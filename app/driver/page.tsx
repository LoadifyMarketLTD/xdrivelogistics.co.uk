'use client';
import {useAuth} from '../components/AuthContext';
import {resolveWorkspaceRole} from '../../lib/workspaceRole';
import ApprovedRoleDashboard from '../components/workspace/ApprovedRoleDashboard';
import DriverWorkspaceShell from './_components/DriverWorkspaceShell';
export default function Page(){
 const {user}=useAuth();
 const role=resolveWorkspaceRole(user);
 const surface=role==='owner_driver'?'owner-driver':role==='driver'?'driver':'company-driver';
 return <DriverWorkspaceShell hideHeader><ApprovedRoleDashboard surface={surface}/></DriverWorkspaceShell>;
}
