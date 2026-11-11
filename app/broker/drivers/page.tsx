'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberFleetOverview from '../../components/workspace/MemberFleetOverview';
export default function Page() { return <ProtectedRoute allowedRoles={['broker']}><MemberFleetOverview section="drivers" /></ProtectedRoute>; }
