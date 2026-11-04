'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import { MemberDirectoryPage } from '../../components/workspace/MemberDirectoryPage';

export default function BrokerDirectoryPage() {
  return <ProtectedRoute allowedRoles={['broker']}><MemberDirectoryPage /></ProtectedRoute>;
}
