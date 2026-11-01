'use client';
import ApprovedRoleDashboard from '../../components/workspace/ApprovedRoleDashboard';
import ProtectedRoute from '../../components/ProtectedRoute';
export default function Page(){return <ProtectedRoute allowedRoles={['owner','company_admin','company_staff']}><ApprovedRoleDashboard surface="fleet"/></ProtectedRoute>;}
