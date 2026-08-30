'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';
import AccountSectionNav from './AccountSectionNav';

const DRIVER_PRIMARY_PAGE_TITLES: Readonly<Record<string, string>> = {
  '/driver': 'Driver Dashboard',
  '/driver/loads': 'Loads',
  '/driver/quotes': 'Quotes',
  '/driver/jobs': 'Jobs',
  '/driver/history': 'Diary',
  '/driver/availability': 'Availability',
  '/driver/availability/live': 'Live Availability',
  '/driver/returns': 'Return Journeys',
  '/driver/account': 'Account',
  '/driver/load-alerts': 'Load Alerts',
};

const DRIVER_ACCOUNT_PREFIXES = [
  '/driver/profile',
  '/driver/vehicles',
  '/driver/documents',
  '/driver/finance',
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
}: {
  children: ReactNode;
  subtitle?: string;
  headerActions?: ReactNode;
  driverName?: string;
  availabilityLabel?: string;
  personaLabel?: string;
}) {
  const pathname = usePathname();
  const resolvedTitle = resolveDriverPageTitle(pathname, driverName);
  const accountPath = isDriverAccountPath(pathname);

  return (
    <PageFrame>
      <div className="driver-operational-page">
        {(resolvedTitle || subtitle || availabilityLabel || personaLabel || headerActions) && (
          <PageHeader
            eyebrow={personaLabel ?? 'Driver workspace'}
            title={resolvedTitle}
            description={subtitle}
            actions={
              <>
                {availabilityLabel && <StatusBadge value={availabilityLabel} />}
                {headerActions}
              </>
            }
          />
        )}
        {accountPath ? (
          <div className="driver-account-workspace">
            <AccountSectionNav />
            <div className="driver-account-workspace__content">{children}</div>
          </div>
        ) : children}
      </div>
    </PageFrame>
  );
}
