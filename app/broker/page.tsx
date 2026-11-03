'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import BrokerDemo3150 from './BrokerDemo3150';

export default function BrokerHomePage() {
  return (
    <ProtectedRoute allowedRoles={['broker']}>
      <BrokerDemo3150 />
    </ProtectedRoute>
  );
}
