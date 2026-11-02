'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DriverProfilePage from './profile/page';

export default function DriverTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/driver/profile') return <DriverProfilePage />;
  return children;
}
