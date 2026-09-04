import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AdminSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav
        aria-label="Account settings"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 6,
          padding: '8px 12px 0',
          background: 'var(--ws-page-bg, #f4f6f8)',
        }}
      >
        <Link
          href="/admin/settings"
          style={{
            border: '1px solid var(--ws-border, #cfd7e3)',
            borderRadius: 'var(--ws-radius, 4px)',
            background: '#fff',
            color: '#334155',
            padding: '6px 9px',
            fontSize: 'var(--ws-font-label, 11px)',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Settings
        </Link>
        <Link
          href="/admin/settings/legal-agreements"
          style={{
            border: '1px solid #1d57d8',
            borderRadius: 'var(--ws-radius, 4px)',
            background: '#fff',
            color: '#0b3f9c',
            padding: '6px 9px',
            fontSize: 'var(--ws-font-label, 11px)',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          Legal & Agreements
        </Link>
      </nav>
      {children}
    </>
  );
}
