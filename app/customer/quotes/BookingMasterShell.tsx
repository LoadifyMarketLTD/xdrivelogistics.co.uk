'use client';

import { usePathname } from 'next/navigation';
import AuthenticatedMasterShell from '../../components/workspace/AuthenticatedMasterShell';
import type { MasterWorkspaceRole } from '../../try-xdrive-demo/components/MasterWorkspacePolicy';
import styles from './BookingMasterShell.module.css';

/**
 * Reuses the live authenticated Master Workspace navigation and RBAC.
 * Does not introduce mock data, parallel navigation, or alternate role pages.
 */
export default function BookingMasterShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const path = usePathname() || '';
  const role: MasterWorkspaceRole = path.startsWith('/broker') ? 'Broker' : path.startsWith('/admin') ? 'Company / Carrier' : 'Customer';
  return <div className={styles.shell}>
    <AuthenticatedMasterShell role={role} activeTab={4}>
      <div className={styles.topbar}><span>Booking offer · Review and confirmation</span><button type="button" onClick={onClose} aria-label="Close booking confirmation">Close ×</button></div>
      {children}
    </AuthenticatedMasterShell>
  </div>;
}
