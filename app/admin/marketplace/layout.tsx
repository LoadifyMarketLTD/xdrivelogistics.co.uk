import Link from 'next/link';
import type { ReactNode } from 'react';

export default function CarrierMarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav aria-label="Carrier marketplace views" style={{ minHeight: 34, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px 0', borderBottom: '1px solid #d8dee8', background: '#f8fafc' }}>
        <Link href="/admin/marketplace" style={{ minHeight: 28, display: 'inline-flex', alignItems: 'center', padding: '0 9px', border: '1px solid #d8dee8', borderRadius: 4, background: '#fff', color: '#0b2f6b', fontSize: 11, fontWeight: 750, textDecoration: 'none' }}>Marketplace</Link>
        <Link href="/admin/marketplace/directory" style={{ minHeight: 28, display: 'inline-flex', alignItems: 'center', padding: '0 9px', border: '1px solid #d8dee8', borderRadius: 4, background: '#fff', color: '#1d57d8', fontSize: 11, fontWeight: 750, textDecoration: 'none' }}>Directory</Link>
        <span style={{ marginLeft: 4, color: '#64748b', fontSize: 10 }}>Marketplace = available work · Directory = XDrive member network</span>
      </nav>
      {children}
    </>
  );
}
