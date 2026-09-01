import type { ReactNode } from 'react';

export default function PricingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        .min-h-screen > main > section:first-child {
          background: linear-gradient(135deg, #173B73 0%, #0E2D5A 100%) !important;
        }
      `}</style>
    </>
  );
}
