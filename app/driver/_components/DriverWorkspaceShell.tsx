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

  if (pathname !== '/driver' && !accountPath) {
    return (
      <section className="page driver-prototype-page-shell">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>{resolvedTitle}</b></span>
          <div className="sub-actions">
            {availabilityLabel && <StatusBadge value={availabilityLabel} />}
            {headerActions}
          </div>
        </div>
        <div className="pagebody no-left">
          <main className="main">
            <div className="head">
              <div><h1>{resolvedTitle}</h1>{subtitle && <p>{subtitle}</p>}</div>
            </div>
            {children}
          </main>
        </div>
      </section>
    );
  }

  return (
    <PageFrame>
      <div className="driver-operational-page">
        {(resolvedTitle || subtitle || availabilityLabel || personaLabel || headerActions) && (
          <PageHeader
            eyebrow={pathname === '/driver' ? undefined : (personaLabel ?? 'Driver workspace')}
            title={resolvedTitle}
            description={subtitle}
            actions={<>{availabilityLabel && <StatusBadge value={availabilityLabel} />}{headerActions}</>}
          />
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
