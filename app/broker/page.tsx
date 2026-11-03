'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import BrokerDemo3150 from './BrokerDemo3150';
import {Company3150LiveProvider} from '../try-xdrive-demo/components/Company3150LiveData';

export default function BrokerHomePage() {
  return (
    <ProtectedRoute allowedRoles={['broker']}>
      <Company3150LiveProvider><BrokerDemo3150 /></Company3150LiveProvider>
    </ProtectedRoute>
  );
}
