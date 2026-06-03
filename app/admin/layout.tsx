import type { ReactNode } from 'react';
import NotificationBell from '../components/NotificationBell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <NotificationBell />
    </>
  );
}
