'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DriverAccountPage from './account/page';
import './driver-dashboard-layout.css';

export default function DriverTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/driver/profile') return <DriverAccountPage />;
  return children;
}
