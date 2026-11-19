'use client';
import ProtectedRoute from '../../../components/ProtectedRoute';
import {useAuth} from '../../../components/AuthContext';
import {resolveWorkspaceRole} from '../../../../lib/workspaceRole';
import {PermissionDeniedState} from '../../../components/workspace/WorkspaceUI';
import Home from '../../../components/workspace/ComplianceControlDashboardHome';
function RoleHome(){const {user}=useAuth();return (user?.workspaceRole??resolveWorkspaceRole(user))==='compliance'?<Home/>:<PermissionDeniedState reason="This dashboard belongs to the authorized compliance workspace."/>;}
export default function Page(){return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}><RoleHome/></ProtectedRoute>;}
