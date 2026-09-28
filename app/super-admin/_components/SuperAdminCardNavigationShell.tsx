'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import type { WorkspaceDefinition } from '../../../lib/workspaceRole';
import type { WorkspaceShellFixtureOverrides } from '../../components/workspace/WorkspaceShell';
import SuperAdminSidebar from './SuperAdminSidebar';
import SuperAdminTopbar from './SuperAdminTopbar';
import styles from './SuperAdminCardNavigationShell.module.css';

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

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('xdrive-super-admin-sidebar-collapsed', String(next));
      return next;
    });
  };

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
        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  );
}
