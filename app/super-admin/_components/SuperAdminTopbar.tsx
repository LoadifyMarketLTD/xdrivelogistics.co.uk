'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle, Bell, ChevronDown, CircleUserRound, Menu,
  PanelLeftClose, PanelLeftOpen, Search,
} from 'lucide-react';
import styles from './SuperAdminCardNavigationShell.module.css';

type Props = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleSidebar: () => void;
  onToggleMobile: () => void;
};

function PlatformSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    router.push(`/super-admin/search?q=${encodeURIComponent(query)}`);
    setValue('');
  };
  return (
    <form className={styles.topbarSearch} role="search" onSubmit={submit}>
      <Search size={18} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search platform..."
        aria-label="Search platform"
        autoComplete="off"
      />
    </form>
  );
}

function OwnerMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <div className={styles.ownerMenuWrap}>
      <button
        type="button"
        className={styles.ownerButton}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <CircleUserRound size={20} aria-hidden="true" />
        <span>Platform Owner</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.ownerMenu} role="menu">
          <Link href="/super-admin" role="menuitem">Command Centre</Link>
          <Link href="/super-admin/directory" role="menuitem">Explore all areas</Link>
          <Link href="/super-admin/platform" role="menuitem">Platform Overview</Link>
          <Link href="/auth/sign-out" role="menuitem" className={styles.ownerMenuDanger}>Sign out</Link>
        </div>
      ) : null}
    </div>
  );
}

export default function SuperAdminTopbar({ collapsed, mobileOpen, onToggleSidebar, onToggleMobile }: Props) {
  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <button
          type="button"
          className={styles.mobileMenuButton}
          onClick={onToggleMobile}
          aria-expanded={mobileOpen}
          aria-label="Toggle Super Admin navigation"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.desktopCollapseButton}
          onClick={onToggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
        </button>
        <PlatformSearch />
      </div>

      <div className={styles.topbarActions}>
        <Link href="/super-admin/action-centre" className={styles.topbarActionLink}>
          <AlertTriangle size={18} aria-hidden="true" />
          <span>Action Centre</span>
        </Link>
        <Link href="/super-admin/notifications" className={styles.topbarIconLink} aria-label="Notifications">
          <Bell size={20} aria-hidden="true" />
        </Link>
        <OwnerMenu />
      </div>
    </header>
  );
}
