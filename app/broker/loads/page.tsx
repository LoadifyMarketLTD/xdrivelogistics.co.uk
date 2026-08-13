'use client';
import Link from 'next/link';
import { BrokerLoadsPage } from '../BrokerWorkspaceModules';

export default function Page() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 24px 0' }}>
        <Link
          href="/broker/loads/enquiries"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            padding: '8px 12px',
            background: '#ffffff',
            color: '#0B2F6B',
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Public Enquiries
        </Link>
      </div>
      <BrokerLoadsPage />
    </>
  );
}
