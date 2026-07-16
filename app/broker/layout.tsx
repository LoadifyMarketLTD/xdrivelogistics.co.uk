import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Broker Workspace | XDrive Logistics',
  description: 'Broker load publishing, bid management and award decisions.',
  robots: { index: false, follow: false },
};

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="authenticated-workspace"
      style={{
        minHeight: '100dvh',
        backgroundColor: '#f5f7fa',
      }}
    >
      {children}
    </div>
  );
}
