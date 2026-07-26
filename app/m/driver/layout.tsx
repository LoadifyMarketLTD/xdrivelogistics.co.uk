import type { ReactNode } from 'react';
import MobileWebDeprecationNotice from '../_components/MobileWebDeprecationNotice';

export default function MobileDriverLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div style={{ padding: '0.75rem 1rem' }}>
        <MobileWebDeprecationNotice />
      </div>
      {children}
    </>
  );
}
