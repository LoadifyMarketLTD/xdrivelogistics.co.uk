'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import CompanyMarketplaceExchange from '../../components/workspace/CompanyMarketplaceExchange';

export default function MarketplacePage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <CompanyMarketplaceExchange />
    </ProtectedRoute>
  );
}
