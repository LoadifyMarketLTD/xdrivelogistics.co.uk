'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';

const DRIVER_PAGE_TITLES: ReadonlyArray<readonly [string, string]> = [
  ['/driver/loads', 'Loads'],
  ['/driver/quotes', 'Quotes'],
  ['/driver/jobs', 'Jobs'],
  ['/driver/history', 'Diary'],
  ['/driver/availability', 'Availability'],
  ['/driver/returns', 'Return Journeys'],
  ['/driver/account', 'Account'],
  ['/driver/profile', 'Account'],
  ['/driver/vehicles', 'Account'],
  ['/driver/documents', 'Account'],
  ['/driver/finance', 'Account'],
  ['/driver/messages', 'Account'],
  ['/driver/change-password', 'Account'],
  ['/driver/event-log', 'Account'],
  ['/driver/notifications', 'Account'],
];

function resolveDriverPageTitle(pathname: string | null) {
  if (!pathname || pathname === '/driver') return 'Driver Dashboard';
  const match = DRIVER_PAGE_TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match?.[1] ?? 'My Work';
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
  const resolvedTitle = driverName ?? resolveDriverPageTitle(pathname);

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
