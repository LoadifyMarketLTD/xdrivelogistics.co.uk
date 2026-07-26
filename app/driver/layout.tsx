import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceShell from '../components/workspace/WorkspaceShell';
import MobileAppBanner from './_components/MobileAppBanner';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B2F6B' };
export const metadata: Metadata = { title: 'Driver Workspace | XDrive Logistics', description: 'Assigned work, availability, vehicle, documents and POD.', robots: { index: false, follow: false } };

function isMobileUserAgent(ua: string) {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const ua = headersList.get('user-agent') ?? '';
  const isMobile = isMobileUserAgent(ua);

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff']}>
      <MobileAppBanner isMobile={isMobile} />
      <WorkspaceShell>{children}</WorkspaceShell>
    </ProtectedRoute>
  );
}
