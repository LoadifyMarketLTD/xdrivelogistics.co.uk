'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, Plus } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { mapAppRole } from '@/lib/authRole';
import { getCapabilitiesForRole } from '@/lib/roleCapabilities';
import {
  getWorkspaceNavigation,
  isWorkspaceNavItemActive,
  type WorkspaceArea,
} from '@/lib/workspaceNavigation';
import WorkspaceNotifications from './WorkspaceNotifications';

const AREA_LABEL: Record<WorkspaceArea, string> = {
  admin: 'Operations',
  broker: 'Broker',
  customer: 'Customer',
  driver: 'Driver',
  'super-admin': 'Platform Control',
};

const primaryAction = (area: WorkspaceArea, canPostLoads: boolean) => {
  if (!canPostLoads) return null;
  if (area === 'customer') return { label: 'Post load', href: '/customer' };
  if (area === 'broker') return { label: 'Post load', href: '/broker/loads' };
  if (area === 'admin') return { label: 'Post load', href: '/admin/marketplace' };
  return null;
};

export default function WorkspacePlatformShell({ area, children }: { area: WorkspaceArea; children: ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = mapAppRole(user?.role);
  const capabilities = getCapabilitiesForRole(role, {
    membershipRole: user?.membershipRole ?? null,
    financeAccess: user?.financeAccess ?? null,
    ownerDriverWorkspace: user?.ownerDriverWorkspace === true,
  });
  const navigation = getWorkspaceNavigation(area, role, capabilities);
  const action = primaryAction(area, capabilities.canPostLoads);

  return (
    <div className="workspace-platform-shell">
      <header className="workspace-platform-header">
        <div className="workspace-brand-row">
          <button className="workspace-mobile-toggle" type="button" onClick={() => setMobileOpen((open) => !open)} aria-label="Toggle workspace navigation">
            <Menu size={18} />
          </button>
          <button className="workspace-brand" type="button" onClick={() => router.push(navigation[0]?.href ?? '/') }>
            <span className="workspace-brand-mark">X</span>
            <span>
              <strong>XDrive</strong>
              <small>{AREA_LABEL[area]} Workspace</small>
            </span>
          </button>
          <div className="workspace-header-actions">
            {action && (
              <button className="workspace-primary-action" type="button" onClick={() => router.push(action.href)}>
                <Plus size={14} /> {action.label}
              </button>
            )}
            <WorkspaceNotifications />
            <button className="workspace-icon-action" type="button" onClick={() => void logout()} aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
        <nav className={`workspace-global-nav${mobileOpen ? ' is-open' : ''}`} aria-label={`${AREA_LABEL[area]} workspace`}>
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={isWorkspaceNavItemActive(pathname, item) ? 'is-active' : undefined}
              onClick={() => { setMobileOpen(false); router.push(item.href); }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="workspace-platform-content">{children}</div>
    </div>
  );
}
