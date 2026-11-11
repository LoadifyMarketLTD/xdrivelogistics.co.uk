'use client';

import { useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import CompanyMarketplaceExchange from '../../components/workspace/CompanyMarketplaceExchange';
import ReceivedBidsPage from '../bids/page';

/**
 * Canonical company Quotes entry point. Submitted quotes are bids the company
 * sent to other posters; Received bids are on loads owned by this company.
 * Both use their existing authorised, real Supabase adapters.
 */
export default function ExchangePage() {
  const [direction, setDirection] = useState<'submitted' | 'received'>('submitted');

  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <div className="xdrive-admin-marketplace-identity" data-workspace="company-quotes">
        <nav className="carrier-exchange-secondary-tabs cx-quote-state-tabs" role="tablist" aria-label="Company quotation direction" style={{ marginBottom: 10 }}>
          <button type="button" role="tab" aria-selected={direction === 'submitted'}
            className={`carrier-exchange-tab${direction === 'submitted' ? ' carrier-exchange-tab--active' : ''}`}
            onClick={() => setDirection('submitted')}>Submitted Quotes</button>
          <button type="button" role="tab" aria-selected={direction === 'received'}
            className={`carrier-exchange-tab${direction === 'received' ? ' carrier-exchange-tab--active' : ''}`}
            onClick={() => setDirection('received')}>Received Bids</button>
        </nav>
        {direction === 'submitted'
          ? <CompanyMarketplaceExchange initialTab="bids" />
          : <ReceivedBidsPage />}
      </div>
    </ProtectedRoute>
  );
}
