import type { ReactNode } from 'react';

export default function PricingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        .min-h-screen > header > div > div:first-child > span {
          display: none !important;
        }
      `}</style>
    </>
  );
}
