'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import type { WorkspaceDefinition } from '../../../lib/workspaceRole';
import type { WorkspaceShellFixtureOverrides } from '../../components/workspace/WorkspaceShell';
import SuperAdminSidebar from './SuperAdminSidebar';
import SuperAdminTopbar from './SuperAdminTopbar';
import styles from './SuperAdminCardNavigationShell.module.css';

const GROUP_DESCRIPTIONS: Record<string, string> = {
  command: 'Platform-wide command, urgent actions, search and operational intelligence.',
  'marketplace-jobs': 'Marketplace activity, jobs, quotes, allocations, deliveries and disputes.',
  'secure-operations': 'Tracking, POD evidence and secure execution oversight.',
  fleet: 'Driver readiness, vehicles, live positions and return journeys.',
  companies: 'Company onboarding, membership, verification and compliance authority.',
  finance: 'Invoices, payments, subscriptions, revenue and financial controls.',
  compliance: 'Identity, insurance, licences, expiries and document review.',
  support: 'Tickets, complaints and support disputes.',
  platform: 'Users, permissions, health, audit, settings and governance.',
};

function routeGroupFallback(pathname: string) {
  if (pathname.startsWith('/super-admin/inspect/company/')) return 'companies';
  if (pathname.startsWith('/super-admin/inspect/driver/') || pathname.startsWith('/super-admin/inspect/vehicle/')) return 'fleet';
  if (pathname.startsWith('/super-admin/inspect/invoice/')) return 'finance';
  if (pathname.startsWith('/super-admin/inspect/ticket/') || pathname.startsWith('/super-admin/inspect/dispute/') || pathname.startsWith('/super-admin/inspect/case/')) return 'support';
  if (pathname.startsWith('/super-admin/inspect/job/') || pathname.startsWith('/super-admin/inspect/pod/')) return 'marketplace-jobs';
  if (pathname.startsWith('/super-admin/inspect/user/')) return 'platform';
  if (pathname.startsWith('/super-admin/cases')) return 'support';
  if (pathname.startsWith('/super-admin/platform')) return 'platform';
  return null;
}

export default function SuperAdminCardNavigationShell({
  children,
  definition,
}: {
  children: ReactNode;
  definition: WorkspaceDefinition;
  fixtureOverrides?: WorkspaceShellFixtureOverrides;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('xdrive-super-admin-sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  const navigationTargets = useMemo(
    () => definition.nav.flatMap((group) => group.items.map((item) => ({
      groupId: group.id,
      label: item.label,
      href: item.href,
    }))),
    [definition.nav],
  );

  const currentTarget = useMemo(() => navigationTargets.find((item) => {
    const [target] = item.href.split('?');
    if (target === definition.homeHref) return pathname === target;
    return pathname === target || pathname.startsWith(`${target}/`);
  }), [definition.homeHref, navigationTargets, pathname]);

  const fallbackGroup = routeGroupFallback(pathname);
  const currentGroup = useMemo(
    () => definition.nav.find((group) => group.id === (currentTarget?.groupId ?? fallbackGroup)) ?? definition.nav[0],
    [currentTarget?.groupId, definition.nav, fallbackGroup],
  );

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('xdrive-super-admin-sidebar-collapsed', String(next));
      return next;
    });
  };
  const showContextBar = pathname !== definition.homeHref && pathname !== '/super-admin/directory';

  return (
    <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ''}`}>
      <SuperAdminSidebar
        definition={definition}
        pathname={pathname}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      {mobileOpen ? (
        <button
          type="button"
          className={styles.mobileBackdrop}
          aria-label="Close Super Admin navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className={styles.shellBody}>
        <SuperAdminTopbar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleSidebar={toggleSidebar}
          onToggleMobile={() => setMobileOpen((current) => !current)}
        />
        {showContextBar ? (
          <section className={styles.contextBar}>
            <div className={styles.contextCopy}>
              <span>{currentGroup?.label ?? 'Platform Owner'}</span>
              <strong>{currentTarget?.label ?? (pathname === '/super-admin/platform' ? 'Platform Overview' : 'Control Centre')}</strong>
              <p>{currentGroup ? GROUP_DESCRIPTIONS[currentGroup.id] : 'Platform-wide administration and investigation.'}</p>
            </div>
          </section>
        ) : null}

        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  );
}
