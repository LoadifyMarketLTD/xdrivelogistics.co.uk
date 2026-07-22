import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import SuperAdminWorkspaceShell from './_components/SuperAdminWorkspaceShell';
import { EnterpriseSettingsBoundary } from '../components/workspace/EnterpriseSettings';

export const metadata: Metadata = {
  title: 'Super Admin | XDrive Logistics',
  description: 'Global platform administration layer for XDrive Logistics.',
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <SuperAdminWorkspaceShell>
      <EnterpriseSettingsBoundary>{children}</EnterpriseSettingsBoundary>
    </SuperAdminWorkspaceShell>
  );
}
