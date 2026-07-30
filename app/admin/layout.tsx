import type { ReactNode } from 'react';
import AdminPlatformShell from './AdminPlatformShell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminPlatformShell>{children}</AdminPlatformShell>;
}
