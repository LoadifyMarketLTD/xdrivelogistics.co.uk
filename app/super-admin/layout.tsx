import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import SuperAdminWorkspaceShell from './_components/SuperAdminWorkspaceShell';
import './super-admin-light.css';
import './super-admin-light-hardening.css';
import './super-admin-visual-preview.css';

// Visual preview branch only: this layout must not be promoted without explicit design approval.
export const metadata: Metadata = {
  title: 'Super Admin Preview | XDrive Logistics',
  description: 'Visual rebuild preview of the XDrive Logistics global platform control plane.',
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="super-admin-light-root super-admin-visual-root">
      <SuperAdminWorkspaceShell>{children}</SuperAdminWorkspaceShell>
    </div>
  );
}
