'use client';

import { useSearchParams } from 'next/navigation';
import { BrokerCustomersPage } from '../BrokerWorkspaceModules';
import BrokerPublicEnquiries from '../enquiries/BrokerPublicEnquiries';

export default function Page() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view');

  if (view === 'enquiries') return <BrokerPublicEnquiries />;
  return <BrokerCustomersPage />;
}
