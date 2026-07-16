import type { Metadata, Viewport } from 'next';
import { WorkspacePlatformShell } from '../components/workspace';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1A1F2B',
};

export const metadata: Metadata = {
  title: 'Legacy Driver App | XDrive Logistics',
  description: 'Deprecated driver workspace retained as a legacy fallback. Active driver work now uses the admin-style workspace.',
  robots: { index: false, follow: false },
};

export default function DriverAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="authenticated-workspace">
      <WorkspacePlatformShell area="driver">{children}</WorkspacePlatformShell>
    </div>
  );
}
