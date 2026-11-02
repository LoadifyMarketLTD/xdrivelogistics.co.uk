'use client';

import { WorkspaceRouteTabs } from '../../components/workspace/WorkspaceUI';

export type DriverIntegratedNavItem = {
  href: string;
  label: string;
};

// Keep the existing Driver page interface while delegating visual geometry and
// longest-prefix active-route selection to the shared operational tabs.
export default function DriverIntegratedNav({ label, items }: { label: string; items: DriverIntegratedNavItem[] }) {
  return <WorkspaceRouteTabs ariaLabel={label} items={items} />;
}
