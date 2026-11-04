'use client';
import ProtectedRoute from '../../components/ProtectedRoute';
import MemberLiveAvailabilityPage from '../../components/workspace/MemberLiveAvailabilityPage';
export default function BrokerLiveAvailabilityPage() {
  return <ProtectedRoute allowedRoles={['broker']}><MemberLiveAvailabilityPage /></ProtectedRoute>;
}
