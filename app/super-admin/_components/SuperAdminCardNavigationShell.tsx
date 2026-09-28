'use client';

import Link from 'next/link';
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
  const [openPrimaryGroup, setOpenPrimaryGroup] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('xdrive-super-admin-sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenPrimaryGroup(null);
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
        <nav className={styles.primaryNav} aria-label="Platform owner primary navigation">
          <div className={styles.primaryNavTrack}>
            {definition.nav.map((group) => {
              const active = group.items.some((item) => (
                item.href === definition.homeHref
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/')
              ));
              const open = openPrimaryGroup === group.id;
              return (
                <div key={group.id} className={styles.primaryNavGroup}>
                  <button
                    type="button"
                    className={[styles.primaryNavButton, active ? styles.primaryNavButtonActive : ''].filter(Boolean).join(' ')}
                    onClick={() => setOpenPrimaryGroup((current) => current === group.id ? null : group.id)}
                    aria-expanded={open}
                    aria-haspopup="menu"
                  >
                    <span>{group.label}</span>
                    <span className={styles.primaryNavCaret} aria-hidden="true">▾</span>
                  </button>
                  {open ? (
                    <div className={styles.primaryNavMenu} role="menu">
                      {group.items.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          role="menuitem"
                          className={pathname === item.href ? styles.primaryNavMenuActive : undefined}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </nav>
        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  );
}
