'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import { CustomerDashboard } from './CustomerWorkspaceModules';

export default function CustomerHomePage() {
  return <ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>;
}
