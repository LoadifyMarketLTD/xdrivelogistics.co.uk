import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A2239',
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
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: '#f3f4f6',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {children}
    </div>
  );
}
