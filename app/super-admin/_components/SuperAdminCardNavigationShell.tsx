'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  ChevronDown,
  CircleUserRound,
  Command,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Truck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import { useAuth } from '../../components/AuthContext';
import type { WorkspaceDefinition } from '../../../lib/workspaceRole';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getActionCentreRoute,
  getNotificationsRoute,
  resolveActionCentreRole,
} from '../../components/workspace/actionCentreConfig';
import type { WorkspaceShellFixtureOverrides } from '../../components/workspace/WorkspaceShell';
import styles from './SuperAdminCardNavigationShell.module.css';

const GROUP_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  'xdrive-logistics': Truck,
  marketplace: Store,
  operations: Route,
  fleet: UsersRound,
  companies: Building2,
  'users-access': UsersRound,
  finance: CreditCard,
  compliance: ShieldCheck,
  support: LifeBuoy,
  platform: Settings2,
};

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
  if (pathname.startsWith('/super-admin/inspect/company/')) return 'companies';
  if (pathname.startsWith('/super-admin/inspect/driver/') || pathname.startsWith('/super-admin/inspect/vehicle/')) return 'fleet';
  if (pathname.startsWith('/super-admin/inspect/invoice/')) return 'finance';
  if (pathname.startsWith('/super-admin/inspect/ticket/') || pathname.startsWith('/super-admin/inspect/dispute/') || pathname.startsWith('/super-admin/inspect/case/')) return 'support';
  if (pathname.startsWith('/super-admin/inspect/job/') || pathname.startsWith('/super-admin/inspect/pod/')) return 'operations';
  if (pathname.startsWith('/super-admin/inspect/user/')) return 'users-access';
  return null;
}

export default function SuperAdminCardNavigationShell({
  children,
  definition,
  fixtureOverrides,
}: {
  children: ReactNode;
  definition: WorkspaceDefinition;
  fixtureOverrides?: WorkspaceShellFixtureOverrides;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [unreadCount, setUnreadCount] = useState(fixtureOverrides?.unreadCount ?? 0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);

  const role = 'platform_owner' as const;
  const actionRole = resolveActionCentreRole(role);
  const actionCentreHref = fixtureOverrides?.actionCentreHref ?? getActionCentreRoute(actionRole);
  const notificationsHref = fixtureOverrides?.notificationsHref ?? getNotificationsRoute(actionRole);
  const companyName = fixtureOverrides?.companyName ?? 'XDrive Logistics';
  const actionCentreAvailable = actionCentreHref !== definition.homeHref;

  const navigationTargets = useMemo(
    () => definition.nav.flatMap((group) => group.items.map((item) => ({
      id: `${group.id}-${item.id}`,
      groupId: group.id,
      group: group.label,
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

  const searchResults = useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();
    if (!normalized) return [];
    return navigationTargets.filter((item) =>
      item.label.toLowerCase().includes(normalized)
      || item.group.toLowerCase().includes(normalized),
    ).slice(0, 7);
  }, [navigationTargets, searchValue]);

  const navigateToTarget = (href: string) => {
    router.push(href);
    setSearchValue('');
    setSearchOpen(false);
    setAccountOpen(false);
    setExploreOpen(false);
  };

  const navigateFromSearch = () => {
    const normalized = searchValue.trim().toLowerCase();
    if (!normalized) return;
    const target = navigationTargets.find((item) => item.label.toLowerCase() === normalized)
      ?? searchResults[0];
    if (target) navigateToTarget(target.href);
  };

  useEffect(() => {
    if (typeof fixtureOverrides?.unreadCount === 'number') {
      setUnreadCount(fixtureOverrides.unreadCount);
      return;
    }
    if (!user?.id || !isSupabaseConfigured) return;
    let cancelled = false;
    const loadUnread = async () => {
      const { count } = await supabase
        .from('notification_events')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .in('status', ['pending', 'failed']);
      if (!cancelled) setUnreadCount(count ?? 0);
    };
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [fixtureOverrides?.unreadCount, user?.id]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSearchOpen(false);
      setAccountOpen(false);
      setExploreOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const showContextBar = pathname !== definition.homeHref;

  return (
    <div ref={shellRef} className={styles.shell}>
      <header className={styles.topbar}>
        <button type="button" className={styles.brand} onClick={() => navigateToTarget(definition.homeHref)} aria-label="Platform Owner home">
          <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={246} height={66} priority className={styles.brandLogo} />
          <span className={styles.brandTitle}>Super Admin</span>
        </button>

        <div className={styles.searchArea}>
          <div className={styles.searchWrap}>
            <Search size={17} className={styles.searchIcon} />
            <input
              value={searchValue}
              onChange={(event) => { setSearchValue(event.target.value); setSearchOpen(Boolean(event.target.value.trim())); setAccountOpen(false); }}
              onFocus={() => setSearchOpen(Boolean(searchValue.trim()))}
              onKeyDown={(event) => { if (event.key === 'Enter') navigateFromSearch(); if (event.key === 'Escape') setSearchOpen(false); }}
              placeholder="Search Super Admin areas…"
              aria-label="Search Super Admin areas"
              autoComplete="off"
              className={styles.searchInput}
            />
            <span className={styles.searchHint}>⌘ K</span>
          </div>
          {searchOpen && searchValue.trim() ? (
            <div className={styles.searchResults} role="listbox">
              {searchResults.length ? searchResults.map((item) => (
                <button key={item.id} type="button" className={styles.searchResult} onClick={() => navigateToTarget(item.href)}>
                  <span><strong>{item.label}</strong><small>{item.group}</small></span><span>→</span>
                </button>
              )) : (
                <div className={styles.searchEmpty}>No matching Super Admin area</div>
              )}
            </div>
          ) : null}
        </div>

        <div className={styles.topbarActions}>
          <button type="button" className={styles.headerButton} onClick={() => setExploreOpen((value) => !value)} aria-expanded={exploreOpen}><Command size={16} /><span>Explore areas</span></button>
          <button
            type="button"
            className={`${styles.headerButton} ${styles.actionCentreButton}`}
            onClick={() => { if (actionCentreAvailable) navigateToTarget(actionCentreHref); }}
            disabled={!actionCentreAvailable}
            title={actionCentreAvailable ? 'Open Action Centre' : 'Action Centre promotion pending runtime gate'}
          ><AlertTriangle size={16} /><span>Action Centre</span></button>
          <button type="button" className={styles.iconButton} onClick={() => navigateToTarget(notificationsHref)} aria-label="Notifications"><Bell size={18} />{unreadCount > 0 ? <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span> : null}</button>
          <div className={styles.accountWrap}>
            <button type="button" className={styles.accountButton} onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen}>
              <span className={styles.avatar}><CircleUserRound size={18} /></span>
              <span className={styles.accountCopy}><strong>Platform Owner</strong><small>{user?.email ?? companyName}</small></span>
              <ChevronDown size={14} />
            </button>
            {accountOpen ? (
              <div className={styles.accountMenu}>
                <div className={styles.accountMenuHeader}><strong>Platform Owner</strong><span>{user?.email ?? companyName}</span></div>
                <button type="button" onClick={() => navigateToTarget(definition.homeHref)}>Super Admin home</button>
                <button type="button" onClick={() => setExploreOpen(true)}>Explore all areas</button>
                <button type="button" className={styles.signOutMenuItem} onClick={() => void logout()}><LogOut size={15} /> Sign out</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {showContextBar ? (
        <section className={styles.contextBar}>
          <div className={styles.contextCopy}>
            <span>{currentGroup?.label ?? 'Platform Owner'}</span>
            <strong>{currentTarget?.label ?? 'Control Centre'}</strong>
            <p>{currentGroup ? GROUP_DESCRIPTIONS[currentGroup.id] : 'Platform-wide administration and investigation.'}</p>
          </div>
          {currentGroup ? (
            <div className={styles.contextLinks}>
              {currentGroup.items.slice(0, 6).map((item) => <button key={item.id} type="button" onClick={() => navigateToTarget(item.href)}>{item.label}</button>)}
              {currentGroup.items.length > 6 ? <button type="button" onClick={() => setExploreOpen(true)}>+{currentGroup.items.length - 6} more</button> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>

      {exploreOpen ? (
        <div className={styles.exploreBackdrop} onClick={() => setExploreOpen(false)}>
          <section className={styles.explorePanel} onClick={(event) => event.stopPropagation()} aria-label="Super Admin areas">
            <div className={styles.exploreHeading}>
              <div><span>Super Admin directory</span><strong>Choose an area by what you want to manage</strong></div>
              <button type="button" onClick={() => setExploreOpen(false)}>Close</button>
            </div>
            <div className={styles.areaGrid}>
              {definition.nav.map((group) => {
                const GroupIcon = GROUP_ICONS[group.id] ?? Activity;
                const active = currentGroup?.id === group.id;
                return (
                  <article key={group.id} className={`${styles.areaCard} ${active ? styles.areaCardActive : ''}`}>
                    <div className={styles.areaCardHead}><span className={styles.areaIcon}><GroupIcon size={18} /></span><div><strong>{group.label}</strong><p>{GROUP_DESCRIPTIONS[group.id] ?? 'Platform administration tools and related workflows.'}</p></div></div>
                    <div className={styles.areaLinks}>{group.items.map((item) => <button type="button" key={item.id} onClick={() => navigateToTarget(item.href)}>{item.label}<span>→</span></button>)}</div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
