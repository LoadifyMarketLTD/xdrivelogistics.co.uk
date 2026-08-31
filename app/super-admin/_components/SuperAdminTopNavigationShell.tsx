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
  Menu,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Truck,
  UsersRound,
  X,
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
import styles from './SuperAdminTopNavigationShell.module.css';

const GROUP_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  'xdrive-logistics': Truck,
  marketplace: Store,
  operations: Route,
  fleet: UsersRound,
  companies: Building2,
  finance: CreditCard,
  compliance: ShieldCheck,
  support: LifeBuoy,
  platform: Settings2,
};

export default function SuperAdminTopNavigationShell({
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const role = 'platform_owner' as const;
  const actionRole = resolveActionCentreRole(role);
  const actionCentreHref = fixtureOverrides?.actionCentreHref ?? getActionCentreRoute(actionRole);
  const notificationsHref = fixtureOverrides?.notificationsHref ?? getNotificationsRoute(actionRole);
  const companyName = fixtureOverrides?.companyName ?? 'XDrive Logistics';

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

  const searchResults = useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();
    if (!normalized) return [];
    return navigationTargets.filter((item) =>
      item.label.toLowerCase().includes(normalized)
      || item.group.toLowerCase().includes(normalized),
    ).slice(0, 7);
  }, [navigationTargets, searchValue]);

  const isActive = (href: string) => {
    const [baseHref] = href.split('?');
    if (baseHref === definition.homeHref) return pathname === baseHref;
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  };

  const navigateToTarget = (href: string) => {
    router.push(href);
    setSearchValue('');
    setSearchOpen(false);
    setAccountOpen(false);
    setMobileNavOpen(false);
  };

  const navigateFromSearch = () => {
    const query = searchValue.trim();
    if (query.length < 2) return;
    navigateToTarget(`/super-admin/search?q=${encodeURIComponent(query)}`);
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
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
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [fixtureOverrides?.unreadCount, user?.id]);

  useEffect(() => {
    const closeFloatingPanels = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSearchOpen(false);
      setAccountOpen(false);
      setMobileNavOpen(false);
    };
    document.addEventListener('mousedown', closeFloatingPanels);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeFloatingPanels);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setAccountOpen(false);
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div ref={shellRef} className={styles.shell}>
      <aside className={`${styles.sidebar} ${mobileNavOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brandBlock}>
          <button type="button" className={styles.brand} onClick={() => navigateToTarget(definition.homeHref)} aria-label="Platform Owner home">
            <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={246} height={66} priority className={styles.brandLogo} />
          </button>
          <div className={styles.controlPlaneLabel}><Command size={12} /> Control plane</div>
        </div>

        <div className={styles.previewStatus}>
          <span className={styles.previewDot} />
          <span>Visual rebuild preview</span>
        </div>

        <nav className={styles.sidebarNav} aria-label="Platform Owner navigation">
          {definition.nav.map((group) => {
            const GroupIcon = GROUP_ICONS[group.id] ?? Activity;
            const collapsed = collapsedGroups.has(group.id);
            const activeGroup = group.items.some((item) => isActive(item.href));
            return (
              <section key={group.id} className={styles.navGroup}>
                <button type="button" className={`${styles.groupHeader} ${activeGroup ? styles.groupHeaderActive : ''}`} onClick={() => toggleGroup(group.id)} aria-expanded={!collapsed}>
                  <span className={styles.groupHeaderLabel}><GroupIcon size={15} strokeWidth={2} />{group.label}</span>
                  <ChevronDown size={14} className={`${styles.groupChevron} ${collapsed ? styles.groupChevronCollapsed : ''}`} />
                </button>
                {!collapsed && (
                  <div className={styles.groupItems}>
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <button key={item.id} type="button" className={`${styles.navItem} ${active ? styles.navItemActive : ''}`} onClick={() => navigateToTarget(item.href)}>
                          <span className={styles.navItemMarker}>{active ? <span /> : null}</span>
                          <span className={styles.navItemLabel}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.privilegeCard}>
            <ShieldCheck size={16} />
            <div>
              <strong>Platform Owner</strong>
              <span>Privileged global authority</span>
            </div>
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button type="button" aria-label="Close navigation" className={styles.mobileOverlay} onClick={() => setMobileNavOpen(false)} />}

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button type="button" className={styles.mobileMenuButton} onClick={() => setMobileNavOpen((value) => !value)} aria-label="Toggle navigation">
              {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <div className={styles.breadcrumbBlock}>
              <span className={styles.breadcrumbEyebrow}>{currentTarget?.group ?? 'Platform Owner'}</span>
              <strong className={styles.breadcrumbTitle}>{currentTarget?.label ?? 'Command Centre'}</strong>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <div className={styles.searchArea}>
              <div className={styles.searchWrap}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  value={searchValue}
                  onChange={(event) => {
                    setSearchValue(event.target.value);
                    setSearchOpen(Boolean(event.target.value.trim()));
                    setAccountOpen(false);
                  }}
                  onFocus={() => setSearchOpen(Boolean(searchValue.trim()))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') navigateFromSearch();
                    if (event.key === 'Escape') setSearchOpen(false);
                  }}
                  placeholder="Search jobs, companies, users, invoices…"
                  aria-label="Global Platform Search"
                  autoComplete="off"
                  className={styles.searchInput}
                />
                <span className={styles.searchHint}>⌘ K</span>
              </div>

              {searchOpen && searchValue.trim().length > 0 && (
                <div className={styles.searchResults} role="listbox">
                  <button type="button" className={`${styles.searchResult} ${styles.searchResultPrimary}`} onClick={navigateFromSearch} disabled={searchValue.trim().length < 2}>
                    <span><strong>Search all platform data</strong><small>“{searchValue.trim()}”</small></span>
                    <Search size={15} />
                  </button>
                  {searchResults.map((item) => (
                    <button key={item.id} type="button" className={styles.searchResult} onClick={() => navigateToTarget(item.href)}>
                      <span><strong>{item.label}</strong><small>{item.group}</small></span>
                      <span className={styles.searchArrow}>→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className={styles.actionCentreButton} onClick={() => navigateToTarget(actionCentreHref)} title="Action Centre">
              <AlertTriangle size={16} />
              <span>Action Centre</span>
            </button>

            <button type="button" className={styles.iconButton} onClick={() => navigateToTarget(notificationsHref)} aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`} title="Notifications">
              <Bell size={18} />
              {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>

            <div className={styles.accountWrap}>
              <button type="button" className={styles.accountButton} onClick={() => { setAccountOpen((value) => !value); setSearchOpen(false); }} aria-expanded={accountOpen}>
                <span className={styles.avatar}><CircleUserRound size={18} /></span>
                <span className={styles.accountCopy}>
                  <strong>Platform Owner</strong>
                  <small>{user?.email ?? companyName}</small>
                </span>
                <ChevronDown size={14} />
              </button>

              {accountOpen && (
                <div className={styles.accountMenu}>
                  <div className={styles.accountMenuHeader}>
                    <strong>Platform Owner</strong>
                    <span>{user?.email ?? companyName}</span>
                  </div>
                  <button type="button" onClick={() => navigateToTarget(definition.homeHref)}>Command Centre</button>
                  <button type="button" className={styles.signOutMenuItem} onClick={() => void logout()}><LogOut size={15} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  );
}
