import type { ReactNode } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverMobileNavigation from './DriverMobileNavigation';
import './driver-mobile.css';

export default function MobileDriverLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff']}>
      <div className="xd-driver-mobile">
        <main id="xd-driver-main" className="xd-driver-mobile__content">{children}</main>
        <DriverMobileNavigation />
      </div>
    </ProtectedRoute>
  );
}
