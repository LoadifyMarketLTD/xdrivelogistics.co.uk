'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import { OwnerConsole } from './OwnerConsole';

export default function SuperAdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <OwnerConsole />
    </ProtectedRoute>
  );
}
