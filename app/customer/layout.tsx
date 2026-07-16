import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Customer Workspace | XDrive Logistics',
  description: 'Customer load posting, delivery tracking and invoice management.',
  robots: { index: false, follow: false },
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <div className="authenticated-workspace">{children}</div>;
}
