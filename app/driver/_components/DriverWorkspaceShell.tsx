'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';

const DRIVER_PRIMARY_PAGE_TITLES: Readonly<Record<string, string>> = {
  '/driver': 'Dashboard',
  '/driver/loads': 'Loads',
  '/driver/quotes': 'Quotes',
  '/driver/jobs': 'Jobs',
  '/driver/history': 'Diary',
  '/driver/availability': 'Availability',
  '/driver/availability/live': 'Live Availability',
  '/driver/returns': 'Return Journeys',
  '/driver/account': 'Account',
  '/driver/profile': 'Profile',
  '/driver/documents': 'Documents',
  '/driver/messages': 'Messages',
  '/driver/notifications': 'Notifications',
  '/driver/change-password': 'Security',
  '/driver/event-log': 'Event Log',
  '/driver/load-alerts': 'Load Alerts',
  '/driver/post-load': 'Post Load',
  '/driver/action-centre': 'Action Centre',
  '/driver/finance': 'Finance',
  '/driver/loads/search': 'Search Loads',
  '/driver/won-work': 'Won Work',
};

const DRIVER_ACCOUNT_PREFIXES = [
  '/driver/profile',
  '/driver/documents',
  '/driver/messages',
  '/driver/change-password',
  '/driver/event-log',
  '/driver/notifications',
  '/driver/load-alerts',
] as const;

function isDriverAccountPath(pathname: string | null) {
  if (!pathname) return false;
  if (pathname === '/driver/account') return true;
  return DRIVER_ACCOUNT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function resolveDriverPageTitle(pathname: string | null, explicitTitle?: string) {
  if (pathname) {
    const primaryTitle = DRIVER_PRIMARY_PAGE_TITLES[pathname];
    if (primaryTitle) return primaryTitle;
    if (pathname.startsWith('/driver/finance/invoices/')) {
      return pathname.endsWith('/edit') ? 'Edit Invoice' : 'Invoice Details';
    }
    if (pathname.startsWith('/driver/loads/')) return 'Load Details';
  }
  if (explicitTitle) return explicitTitle;
  if (isDriverAccountPath(pathname)) return 'Account';
  return 'My Work';
}

export default function DriverWorkspaceShell({
  children,
  subtitle,
  headerActions,
  driverName,
  availabilityLabel,
  personaLabel,
  hideHeader = false,
}: {
  children: ReactNode;
  subtitle?: string;
  headerActions?: ReactNode;
  driverName?: string;
  availabilityLabel?: string;
  personaLabel?: string;
  hideHeader?: boolean;
}) {
  const pathname = usePathname();
  const resolvedTitle = resolveDriverPageTitle(pathname, driverName);
  const accountPath = isDriverAccountPath(pathname);

  return (
    <PageFrame>
      <div className="driver-operational-page">
        {!hideHeader && (resolvedTitle || subtitle || personaLabel) && (
          <PageHeader
            eyebrow={pathname === '/driver' ? undefined : (personaLabel ?? 'Driver workspace')}
            title={resolvedTitle}
            description={subtitle}
          />
        )}
        {(availabilityLabel || headerActions) && (
          <div className="workspace-record-meta workspace-list-controls driver-workspace-page-toolbar" style={{ justifyContent: 'flex-end' }}>
            <span className="workspace-list-controls__right">
              {availabilityLabel && <StatusBadge value={availabilityLabel} />}
              {headerActions}
            </span>
          </div>
        )}
        {accountPath ? (
          <div className="driver-account-workspace driver-account-workspace--single">
            <div className="driver-account-workspace__content">{children}</div>
          </div>
        ) : children}
      </div>
    </PageFrame>
  );
}
