import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { WorkspacePlatformShell } from '../components/workspace';

export const metadata: Metadata = {
  title: 'Super Admin | XDrive Logistics',
  description: 'Global platform administration layer for XDrive Logistics.',
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return <div className="authenticated-workspace"><WorkspacePlatformShell area="super-admin">{children}</WorkspacePlatformShell></div>;
}
