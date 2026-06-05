import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import PlatformWorkspaceShell from './_components/PlatformWorkspaceShell';

export const metadata: Metadata = {
  title: 'Platform Governance | XDrive Logistics',
  description: 'Owner governance console for XDrive Logistics platform.',
  robots: { index: false, follow: false },
};

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <PlatformWorkspaceShell>{children}</PlatformWorkspaceShell>;
}
