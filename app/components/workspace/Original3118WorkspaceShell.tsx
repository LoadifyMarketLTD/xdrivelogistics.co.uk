'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { isCapabilityAllowedForPath } from '../../../lib/roleCapabilities';
import { getVisibleWorkspaceNav, getWorkspaceDefinition, resolveWorkspaceRole, type WorkspaceRole } from '../../../lib/workspaceRole';
import { getNotificationsRoute, resolveActionCentreRole } from './actionCentreConfig';
import { activeOriginal3118RouteIndex, appendAuthorised3118Routes, original3118AccountRoute } from './original3118NavigationModel';
import ApprovedSidebar from '../../company3118/components/ApprovedSidebar';
import MasterLogoutButton from '../../try-xdrive-demo/components/MasterLogoutButton';
import '../../company3118/xdrive-design-system.css';
import '../../company3118/demo.css';
import '../../company3118/wide-layout.css';
import '../../company3118/components/operations-demo.css';
import '../../company3118/components/company-sidebar-compact.css';
import '../../company3118/components/company-layout-stability.css';
import '../../try-xdrive-demo/components/mobile-master-navigation.css';

/** Original 3118 shell/sidebar and styles, backed by MAIN's authenticated role-specific routes. */
export default function Original3118WorkspaceShell({ children, forcedRole }: { children: ReactNode; forcedRole?: WorkspaceRole }) {
  const { user, isLoading } = useAuth();
  const role = forcedRole ?? resolveWorkspaceRole(user);
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const definition = getWorkspaceDefinition(role);
  const persona = role === 'driver' && (user?.rawRole === 'company_driver' || user?.role === 'company_staff')
    ? 'company_driver' : role;
  const accountHref = original3118AccountRoute(role);
  const notificationHref = getNotificationsRoute(resolveActionCentreRole(role));
  const navigation = useMemo(() => {
    if (isLoading || !user) return [];
    const accessContext = {
      membershipId: user.membershipId, membershipRole: user.membershipRole,
      financeAccess: user.financeAccess, rawRole: user.rawRole, workspaceRole: role,
      driverId: user.driverId, canCommercialBid: user.canCommercialBid,
      driverStatus: user.driverStatus, appAccess: user.appAccess,
      accountStatus: user.accountStatus, companyStatus: user.companyStatus,
      ownerDriverWorkspace: user.ownerDriverWorkspace,
      ownerDriverExecutionMode: user.ownerDriverExecutionMode,
      canAccessDriverMode: user.canAccessDriverMode,
    };
    const allowed = (href: string) => isCapabilityAllowedForPath(
      href, user.role === 'guest' ? null : user.role, accessContext,
    );
    const seen = new Set<string>();
    const visible = getVisibleWorkspaceNav(role).flatMap(group => group.items)
      .filter(item => allowed(item.href))
      .filter(item => {
        if (seen.has(item.href)) return false;
        seen.add(item.href);
        return true;
      }).map(item => ({ label: item.label, href: item.href }));
    return appendAuthorised3118Routes(visible, accountHref, notificationHref, allowed);
  }, [accountHref, isLoading, notificationHref, role, user]);
  const active = useMemo(
    () => activeOriginal3118RouteIndex(navigation, pathname, definition.homeHref),
    [definition.homeHref, navigation, pathname],
  );
  const navigate = (index: number) => {
    const href = navigation[index]?.href;
    if (!href) return;
    setMobileOpen(false);
    router.push(href);
  };

  // The original 3118 mobile sidebar locks scroll and supports Escape-to-close.
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('keydown', close);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <main className="demo-shell ops-demo xd-approved-sidebar-shell"
      data-original-workspace="3118" data-workspace-role={role} data-workspace-persona={persona}>
      <button type="button" className={'xd-mobile-sidebar-backdrop' + (mobileOpen ? ' is-open' : '')}
        aria-label="Close workspace navigation" tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)} />
      <ApprovedSidebar items={navigation.map(item => item.label)} activeIndex={active}
        onSelect={navigate} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="content">
        <header className="topbar">
          <button type="button" className="xd-mobile-nav-toggle" aria-label="Open workspace menu"
            aria-controls="xdrive-master-mobile-navigation" aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}><Menu size={21} aria-hidden="true" /> Menu</button>
          <div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div>
          <div className="top-actions">
            {navigation.some(item => item.href === accountHref) && <Link href={accountHref}>Settings</Link>}
            {navigation.some(item => item.href === notificationHref) && <Link href={notificationHref}>Notifications</Link>}
            <MasterLogoutButton />
          </div>
        </header>
        <nav className="mobile-tabs" aria-label={`${persona === 'company_driver' ? 'Company Driver' : definition.label} navigation`}>
          {navigation.map((item, index) => <button type="button" key={item.href}
            className={active === index ? 'active' : ''} onClick={() => navigate(index)}>{item.label}</button>)}
        </nav>
        <div className="page">{children}</div>
      </div>
    </main>
  );
}
