'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import CompanyMarketplaceExchange from '../../components/workspace/CompanyMarketplaceExchange';
import Master3150BookingHeader from '../../components/workspace/Master3150BookingHeader';

export default function WonWorkPage() {
  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <>
        <Master3150BookingHeader />
        <CompanyMarketplaceExchange initialTab="won" />
      </>
    </ProtectedRoute>
  );
}
