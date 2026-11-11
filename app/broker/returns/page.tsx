'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberReturnJourneysPage from '../../components/workspace/MemberReturnJourneysPage';
export default function BrokerReturnJourneysPage() {return <ProtectedRoute allowedRoles={['broker']}><MemberReturnJourneysPage/></ProtectedRoute>;}
