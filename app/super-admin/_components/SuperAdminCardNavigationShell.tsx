'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import type { WorkspaceDefinition } from '../../../lib/workspaceRole';
import type { WorkspaceShellFixtureOverrides } from '../../components/workspace/WorkspaceShell';
import SuperAdminNavbar from './SuperAdminNavbar';
import styles from './SuperAdminCardNavigationShell.module.css';

const GROUP_DESCRIPTIONS: Record<string, string> = {
  dashboard: 'Overview, urgent actions, analytics and live platform health.',
  'xdrive-logistics': 'Run XDrive Logistics operational workspace.',
  marketplace: 'Manage marketplace visibility, quotes, allocations and disputes.',
  operations: 'Monitor jobs, deliveries, POD queues and operational exceptions.',
  fleet: 'Manage drivers, availability and fleet positions.',
  companies: 'Manage company onboarding, approvals, verification and compliance.',
  'users-access': 'Manage platform users and workspace access authority.',
  finance: 'Review invoices, payments and financial operations.',
  compliance: 'Review documents, insurance, licences, expiries and fraud.',
  support: 'Handle support tickets, complaints and disputes.',
  platform: 'Control settings, permissions, users and audit logs.',
};

function fallbackGroupId(pathname: string) {
  if (pathname.startsWith('/super-admin/action-centre') || pathname.startsWith('/super-admin/cases')) return 'support';
  if (pathname.startsWith('/super-admin/inspect/company/')) return 'companies';
  if (pathname.startsWith('/super-admin/inspect/driver/') || pathname.startsWith('/super-admin/inspect/vehicle/')) return 'fleet';
  if (pathname.startsWith('/super-admin/inspect/invoice/')) return 'finance';
  if (pathname.startsWith('/super-admin/inspect/ticket/') || pathname.startsWith('/super-admin/inspect/dispute/') || pathname.startsWith('/super-admin/inspect/case/')) return 'support';
  if (pathname.startsWith('/super-admin/inspect/job/') || pathname.startsWith('/super-admin/inspect/pod/')) return 'operations';
  if (pathname.startsWith('/super-admin/inspect/user/')) return 'users-access';
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

  const navigationTargets = useMemo(
    () => definition.nav.flatMap((group) => group.items.map((item) => ({
      groupId: group.id,
      label: item.label,
      href: item.href,
    }))),
    [definition.nav],
  );

  const currentTarget = useMemo(() => navigationTargets.find((item) => {
    const [baseHref] = item.href.split('?');
    if (baseHref === definition.homeHref) return pathname === baseHref;
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  }), [definition.homeHref, navigationTargets, pathname]);

  const fallbackGroup = fallbackGroupId(pathname);
  const currentGroup = useMemo(
    () => definition.nav.find((group) => group.id === (currentTarget?.groupId ?? fallbackGroup)) ?? definition.nav[0],
    [currentTarget?.groupId, definition.nav, fallbackGroup],
  );

  const showContextBar = pathname !== definition.homeHref && pathname !== '/super-admin/directory';

  return (
    <div className={styles.shell}>
      <SuperAdminNavbar />

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
  );
}
