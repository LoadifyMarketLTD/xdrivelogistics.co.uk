import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import SuperAdminWorkspaceShell from './_components/SuperAdminWorkspaceShell';
import './super-admin-light.css';
import './super-admin-light-hardening.css';

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
