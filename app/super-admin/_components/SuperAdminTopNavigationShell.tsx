'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

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

const NAV_CLOSE_DELAY_MS = 140;

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
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(fixtureOverrides?.unreadCount ?? 0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const role = 'platform_owner' as const;
  const actionRole = resolveActionCentreRole(role);
  const actionCentreHref = fixtureOverrides?.actionCentreHref ?? getActionCentreRoute(actionRole);
  const notificationsHref = fixtureOverrides?.notificationsHref ?? getNotificationsRoute(actionRole);
  const companyName = fixtureOverrides?.companyName ?? 'XDrive Logistics';

  const navigationTargets = useMemo(
    () =>
      definition.nav.flatMap((group) =>
        group.items.map((item) => ({
          id: `${group.id}-${item.id}`,
          group: group.label,
          label: item.label,
          href: item.href,
        })),
      ),
    [definition.nav],
  );

  const searchResults = useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();
    if (!normalized) return [];
    return navigationTargets
      .filter((item) =>
        item.label.toLowerCase().includes(normalized)
        || item.group.toLowerCase().includes(normalized),
      )
      .slice(0, 6);
  }, [navigationTargets, searchValue]);

  const isActive = (href: string) => {
    const [baseHref] = href.split('?');
    if (baseHref === definition.homeHref) return pathname === baseHref;
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  };

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openNavigationGroup = useCallback((groupId: string) => {
    cancelScheduledClose();
    setOpenGroup(groupId);
    setAccountOpen(false);
    setSearchOpen(false);
  }, [cancelScheduledClose]);

  const scheduleNavigationClose = useCallback(() => {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenGroup(null);
      closeTimerRef.current = null;
    }, NAV_CLOSE_DELAY_MS);
  }, [cancelScheduledClose]);

  const navigateToTarget = (href: string) => {
    cancelScheduledClose();
    router.push(href);
    setSearchValue('');
    setSearchOpen(false);
    setOpenGroup(null);
    setAccountOpen(false);
  };

  const navigateFromSearch = () => {
    const query = searchValue.trim();
    if (query.length < 2) return;
    navigateToTarget(`/super-admin/search?q=${encodeURIComponent(query)}`);
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
    const closeMenus = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        cancelScheduledClose();
        setOpenGroup(null);
        setAccountOpen(false);
        setSearchOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      cancelScheduledClose();
      setOpenGroup(null);
      setAccountOpen(false);
      setSearchOpen(false);
    };
    document.addEventListener('mousedown', closeMenus);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenus);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [cancelScheduledClose]);

  useEffect(() => {
    cancelScheduledClose();
    setOpenGroup(null);
    setAccountOpen(false);
    setSearchOpen(false);
  }, [cancelScheduledClose, pathname]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  return (
    <div className={styles.shell}>
      <div ref={navRef} className={styles.top}>
        <header className={styles.header}>
          <button
            type="button"
            onClick={() => navigateToTarget(definition.homeHref)}
            aria-label="Platform Owner home"
            className={styles.brand}
          >
            <Image
              src="/xdrive-logo-horizontal.png"
              alt="XDrive Logistics"
              width={246}
              height={66}
              priority
              className={styles.brandLogo}
            />
          </button>

          <nav aria-label="Platform Owner navigation" className={styles.nav}>
            {definition.nav.map((group) => {
              const groupActive = group.items.some((item) => isActive(item.href));
              const open = openGroup === group.id;
              const buttonClass = [
                styles.groupButton,
                groupActive ? styles.groupActive : '',
                open ? styles.groupOpen : '',
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={group.id}
                  className={styles.group}
                  onMouseEnter={() => openNavigationGroup(group.id)}
                  onMouseLeave={scheduleNavigationClose}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={open}
                    onFocus={() => openNavigationGroup(group.id)}
                    onClick={() => {
                      cancelScheduledClose();
                      setOpenGroup((value) => (value === group.id ? null : group.id));
                      setAccountOpen(false);
                      setSearchOpen(false);
                    }}
                    className={buttonClass}
                  >
                    {group.label}
                    <span aria-hidden="true" className={styles.chevron}>▾</span>
                  </button>

                  {open && (
                    <div
                      role="menu"
                      aria-label={`${group.label} navigation`}
                      className={styles.dropdown}
                      onMouseEnter={cancelScheduledClose}
                      onMouseLeave={scheduleNavigationClose}
                    >
                      <div className={styles.dropdownTitle}>{group.label}</div>
                      {group.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            onClick={() => navigateToTarget(item.href)}
                            className={`${styles.menuItem} ${active ? styles.menuItemActive : ''}`}
                          >
                            <span aria-hidden="true" className={styles.itemIcon}>{item.icon ?? '•'}</span>
                            <span className={styles.itemText}>
                              <span className={styles.itemLabel}>{item.label}</span>
                              <span className={styles.itemDescription}>
                                {navigationDescription(group.id, item.id)}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className={styles.actions}>
            <div className={styles.searchArea}>
              <div className={styles.searchWrap}>
                <span aria-hidden="true" className={styles.searchIcon}>⌕</span>
                <input
                  value={searchValue}
                  onChange={(event) => {
                    setSearchValue(event.target.value);
                    setSearchOpen(Boolean(event.target.value.trim()));
                    setOpenGroup(null);
                    setAccountOpen(false);
                  }}
                  onFocus={() => setSearchOpen(Boolean(searchValue.trim()))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') navigateFromSearch();
                    if (event.key === 'Escape') setSearchOpen(false);
                  }}
                  placeholder="Search platform"
                  aria-label="Global Platform Search"
                  aria-expanded={searchOpen}
                  aria-controls="platform-owner-search-results"
                  autoComplete="off"
                  className={styles.searchInput}
                />
              </div>

              {searchOpen && searchValue.trim().length > 0 && (
                <div id="platform-owner-search-results" className={styles.searchResults} role="listbox">
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    className={styles.searchResult}
                    onClick={navigateFromSearch}
                    disabled={searchValue.trim().length < 2}
                  >
                    <span className={styles.searchResultLabel}>Search platform for “{searchValue.trim()}”</span>
                    <span className={styles.searchResultGroup}>Global Platform Search</span>
                  </button>
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      className={styles.searchResult}
                      onClick={() => navigateToTarget(item.href)}
                    >
                      <span className={styles.searchResultLabel}>{item.label}</span>
                      <span className={styles.searchResultGroup}>{item.group} · Navigation</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigateToTarget(definition.homeHref)}
              className={styles.homeButton}
            >
              Home
            </button>

            <button
              type="button"
              onClick={() => navigateToTarget(actionCentreHref)}
              className={styles.actionButton}
            >
              Action Centre
            </button>

            <button
              type="button"
              onClick={() => navigateToTarget(notificationsHref)}
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              title="Notifications"
              className={styles.notificationButton}
            >
              <span aria-hidden="true">🔔</span>
              {unreadCount > 0 && (
                <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            <div className={styles.accountWrap}>
              <button
                type="button"
                onClick={() => {
                  cancelScheduledClose();
                  setAccountOpen((value) => !value);
                  setOpenGroup(null);
                  setSearchOpen(false);
                }}
                aria-expanded={accountOpen}
                className={styles.accountButton}
              >
                <span aria-hidden="true" className={styles.avatar}>PO</span>
                <span className={styles.accountLabel}>{user?.email ?? companyName}</span>
                <span aria-hidden="true" className={styles.chevron}>▾</span>
              </button>

              {accountOpen && (
                <div className={styles.accountMenu}>
                  <div className={styles.accountMeta}>
                    <div className={styles.accountRole}>PLATFORM OWNER</div>
                    <div className={styles.accountEmail}>{user?.email ?? ''}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToTarget(definition.homeHref)}
                    className={styles.accountMenuButton}
                  >
                    Home / Command Centre
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className={`${styles.accountMenuButton} ${styles.signout}`}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void logout()}
              className={styles.signOutButton}
            >
              Sign out
            </button>
          </div>
        </header>
      </div>

      <main className={styles.main}>{children}</main>
    </div>
  );
}

function navigationDescription(groupId: string, itemId: string) {
  const descriptions: Record<string, string> = {
    'dashboard-command-centre': 'Live operational command and action queues',
    'dashboard-global-search': 'Find and inspect canonical platform entities',
    'dashboard-action-centre': 'Persistent cross-domain cases and investigations',
    'dashboard-analytics': 'Cross-platform KPI and trend reporting',
    'dashboard-health': 'Service health and integration readiness',
    'dashboard-notifications': 'Platform notification delivery and failures',
    'marketplace-marketplace': 'Global marketplace workload',
    'marketplace-quotes': 'Commercial quotes across the platform',
    'marketplace-allocations': 'Award and allocation oversight',
    'marketplace-disputes': 'Marketplace dispute workflow',
    'operations-jobs': 'All transport jobs',
    'operations-active-jobs': 'Work currently in progress',
    'operations-pending-jobs': 'Work awaiting progression',
    'operations-completed-jobs': 'Delivered and completed workload',
    'operations-deliveries': 'Delivery execution overview',
    'operations-pods': 'Proof-of-delivery review queue',
    'fleet-drivers': 'Driver accounts and fleet membership',
    'fleet-driver-availability': 'Current driver readiness',
    'fleet-fleet-positions': 'Live operational fleet positions',
    'companies-companies': 'All registered platform companies',
    'companies-approvals': 'Applications awaiting platform approval',
    'companies-active': 'Approved active companies',
    'companies-suspended': 'Restricted company accounts',
    'companies-verification': 'Company identity verification',
    'companies-company-compliance': 'Company-level compliance status',
    'finance-finance-overview': 'Global financial position',
    'finance-invoices': 'Invoice workload and exceptions',
    'finance-fees': 'Fees and financial breakdown',
    'finance-revenue': 'Revenue reporting',
    'finance-payments': 'Payment status and receipts',
    'compliance-fraud-cases': 'Identity and fraud investigations',
    'compliance-insurance': 'Insurance review and expiry',
    'compliance-licences': 'Operator licence oversight',
    'compliance-expiries': 'Compliance expiry monitoring',
    'compliance-documents': 'Document review queue',
    'support-tickets': 'Platform support workload',
    'support-complaints': 'Complaint management',
    'support-support-disputes': 'Support-led dispute handling',
    'platform-global': 'Platform-wide configuration',
    'platform-roles': 'Access and permission governance',
    'platform-flags': 'Feature rollout controls',
    'platform-audit': 'Administrative audit trail',
    'platform-users': 'All platform users',
    'platform-admins': 'Privileged platform administrators',
  };
  return descriptions[`${groupId}-${itemId}`] ?? 'Open section';
}
