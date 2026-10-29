import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './loads.css';
import './visual-standard.css';
import './booking-approved.css';
import './booking-approved-extra.css';
import './booking-approved-actions.css';
import './booking-contact.css';
import './booking-receipts.css';
import DriverServiceWorkerRegistration from './DriverServiceWorkerRegistration';

export const metadata: Metadata = {
  title: 'XDrive Driver',
  description: 'XDrive Logistics driver jobs, quotes and bookings',
  applicationName: 'XDrive Driver',
  manifest: '/driver-pwa-fresh/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'XDrive Driver', statusBarStyle: 'default' },
};

export default function FreshDriverLayout({ children }: { children: ReactNode }) {
  return <div className="fresh-driver-pwa"><DriverServiceWorkerRegistration />{children}</div>;
}
