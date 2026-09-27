'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import CompanyMarketplaceExchange from '../../components/workspace/CompanyMarketplaceExchange';

export default function WonWorkPage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <CompanyMarketplaceExchange initialTab="won" />
    </ProtectedRoute>
  );
}
