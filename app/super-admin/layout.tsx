import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import DashboardCompletionLayer from '../components/workspace/DashboardCompletionLayer';
import SuperAdminWorkspaceShell from './_components/SuperAdminWorkspaceShell';

export const metadata: Metadata = {
  title: 'Super Admin | XDrive Logistics',
  description: 'Global platform administration layer for XDrive Logistics.',
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <SuperAdminWorkspaceShell>
      {children}
      <DashboardCompletionLayer mode="super-admin" />
    </SuperAdminWorkspaceShell>
  );
}
