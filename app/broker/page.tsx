'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import MasterWorkspace from "../try-xdrive-demo/components/MasterWorkspace";
import {Company3150LiveProvider} from '../try-xdrive-demo/components/Company3150LiveData';

export default function BrokerHomePage() {
  return (
    <ProtectedRoute allowedRoles={['broker']}>
      <Company3150LiveProvider><MasterWorkspace role="Broker"/></Company3150LiveProvider>
    </ProtectedRoute>
  );
}
