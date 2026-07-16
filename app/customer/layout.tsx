import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { WorkspacePlatformShell } from '../components/workspace';

export const metadata: Metadata = {
  title: 'Customer Workspace | XDrive Logistics',
  description: 'Customer load posting, delivery tracking and invoice management.',
  robots: { index: false, follow: false },
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <div className="authenticated-workspace"><WorkspacePlatformShell area="customer">{children}</WorkspacePlatformShell></div>;
}
