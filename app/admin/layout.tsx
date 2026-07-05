import type { ReactNode } from 'react';
import NotificationBell from '../components/NotificationBell';
import FeedbackWidget from '../components/FeedbackWidget';
import AdminPlatformShell from './AdminPlatformShell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminPlatformShell>{children}</AdminPlatformShell>
      <NotificationBell />
      <FeedbackWidget />
    </>
  );
}
