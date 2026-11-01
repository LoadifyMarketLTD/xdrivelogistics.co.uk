'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import ApprovedLiveExchange from '../../components/workspace/ApprovedLiveExchange';

export default function MarketplacePage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <ApprovedLiveExchange />
    </ProtectedRoute>
  );
}
