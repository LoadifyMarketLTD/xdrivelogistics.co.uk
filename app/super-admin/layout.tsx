import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import SuperAdminWorkspaceShell from './_components/SuperAdminWorkspaceShell';
import './super-admin-light.css';
import './super-admin-light-hardening.css';

// The protected Super Admin document receives a per-request CSP nonce from
// middleware. Next.js can only apply that nonce to framework/page scripts when
// the route is rendered dynamically for the incoming request; a statically
// prerendered shell can otherwise be blocked by the strict CSP on hard reload.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Super Admin | XDrive Logistics',
  description: 'Global platform administration layer for XDrive Logistics.',
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="super-admin-light-root">
      <SuperAdminWorkspaceShell>{children}</SuperAdminWorkspaceShell>
    </div>
  );
}
