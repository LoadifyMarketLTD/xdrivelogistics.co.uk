import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverMobileNavigation from './DriverMobileNavigation';
import DriverPwaRegistration from './DriverPwaRegistration';
import './driver-mobile.css';
import './driver-v2-tokens.css';
import './driver-v2-components.css';
import './driver-v2-page-parity.css';
import './driver-v2-direct-measurements.css';

export const metadata: Metadata = { title: 'XDrive Driver', manifest: '/xdrive-driver.webmanifest', robots: { index: false, follow: false } };

export default function MobileDriverLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff']}>
      <div className="xd-driver-mobile">
        <DriverPwaRegistration />
        <main id="xd-driver-main" className="xd-driver-mobile__content">{children}</main>
        <DriverMobileNavigation />
      </div>
    </ProtectedRoute>
  );
}
