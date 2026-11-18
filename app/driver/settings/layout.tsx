'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../../components/AuthContext';
import { WorkspaceRouteTabs } from '@/app/components/workspace/WorkspaceUI';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';

// Only Owner Driver uses its six-category settings sidebar.
// Preserve the existing route tabs for Company Driver and other allowed users.
export default function DriverSettingsLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isOwnerDriver = resolveWorkspaceRole(user) === 'owner_driver';

  if (isOwnerDriver) return <>{children}</>;

  return (
    <>
      <WorkspaceRouteTabs
        ariaLabel="Account settings"
        items={[
          { href: '/driver/settings', label: 'Settings' },
          { href: '/driver/account/legal-agreements', label: 'Legal & Agreements' },
        ]}
      />
      {children}
    </>
  );
}
