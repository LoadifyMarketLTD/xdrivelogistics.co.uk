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
      style={{
        minHeight: '100dvh',
        backgroundColor: '#f3f4f6',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {children}
    </div>
  );
}
