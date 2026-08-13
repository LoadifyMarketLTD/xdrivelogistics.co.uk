'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { BrokerCustomersPage } from '../BrokerWorkspaceModules';
import BrokerPublicEnquiries from '../enquiries/BrokerPublicEnquiries';

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enquiries = searchParams.get('view') === 'enquiries';

  return (
    <>
      <div style={{ display: 'flex', gap: 8, padding: '12px 12px 0' }}>
        <button
          type="button"
          onClick={() => router.push('/broker/customers')}
          style={{
            height: 32,
            padding: '0 14px',
            borderRadius: 4,
            border: `1px solid ${enquiries ? '#D8DEE8' : '#1D57D8'}`,
            background: enquiries ? '#fff' : '#1D57D8',
            color: enquiries ? '#1A1F2B' : '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Customers
        </button>
        <button
          type="button"
          onClick={() => router.push('/broker/customers?view=enquiries')}
          style={{
            height: 32,
            padding: '0 14px',
            borderRadius: 4,
            border: `1px solid ${enquiries ? '#F5A300' : '#D8DEE8'}`,
            background: enquiries ? '#F5A300' : '#fff',
            color: '#1A1F2B',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Public Enquiries
        </button>
      </div>
      {enquiries ? <BrokerPublicEnquiries /> : <BrokerCustomersPage />}
    </>
  );
}
