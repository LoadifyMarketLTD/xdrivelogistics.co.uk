'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DriverAccountPage from './account/page';

export default function DriverTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/driver/profile') return <DriverAccountPage />;
  return children;
}
