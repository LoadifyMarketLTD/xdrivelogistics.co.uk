'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberFreightVisionPage from '../../components/workspace/MemberFreightVisionPage';
export default function BrokerFreightVisionPage(){return <ProtectedRoute allowedRoles={['broker']}><MemberFreightVisionPage role="broker"/></ProtectedRoute>;}
