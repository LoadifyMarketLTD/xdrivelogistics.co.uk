'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';

const DRIVER_PRIMARY_PAGE_TITLES: Readonly<Record<string, string>> = {
  '/driver': 'Driver Dashboard',
  '/driver/loads': 'Loads',
  '/driver/quotes': 'Quotes',
  '/driver/jobs': 'Jobs',
  '/driver/history': 'Diary',
  '/driver/availability': 'Availability',
  '/driver/returns': 'Return Journeys',
  '/driver/account': 'Account',
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
] as const;

function resolveDriverPageTitle(pathname: string | null, explicitTitle?: string) {
  if (pathname) {
    const primaryTitle = DRIVER_PRIMARY_PAGE_TITLES[pathname];
    if (primaryTitle) return primaryTitle;
  }
  if (explicitTitle) return explicitTitle;
  if (pathname && DRIVER_ACCOUNT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return 'Account';
  }
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
        {children}
      </div>
    </PageFrame>
  );
}
