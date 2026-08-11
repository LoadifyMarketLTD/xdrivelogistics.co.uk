'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getVisibleWorkspaceNav,
  getWorkspaceDefinition,
  hasWorkspaceCapability,
  resolveWorkspaceSurfaceRole,
  type WorkspaceDefinition,
  resolveWorkspaceRole,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';
import SharedContextControls from './SharedContextControls';
import { WorkspaceActivityFeed, workspaceTheme } from './WorkspaceUI';
import {
  getActionCentreRoute,
  getNotificationsRoute,
  resolveActionCentreRole,
  resolveRoleScopedHref,
} from './actionCentreConfig';
import {
  WORKSPACE_SHELL_BREAKPOINTS,
  WORKSPACE_SHELL_DIMENSIONS,
  workspaceShellPx,
} from './workspaceShellContract';
import styles from './WorkspaceShell.module.css';

export type WorkspaceShellFixtureOverrides = {
  companyName?: string;
  unreadCount?: number;
  tickerItems?: Array<{ id: string; label: string; reference: string | null; created_at: string; href?: string | null }>;
  tickerError?: string;
  actionCentreHref?: string;
  notificationsHref?: string;
};

export default function WorkspaceShell({
  children,
  forcedRole,
  fixtureOverrides,
  definitionOverride,
}: {
  children: ReactNode;
  forcedRole?: WorkspaceRole;
  fixtureOverrides?: WorkspaceShellFixtureOverrides;
  definitionOverride?: WorkspaceDefinition;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState<string>('XDrive Logistics');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [tickerItems, setTickerItems] = useState<Array<{ id: string; label: string; reference: string | null; created_at: string; href?: string | null }>>([]);
  const [tickerError, setTickerError] = useState('');
  const tickerTimerRef = useRef<number | null>(null);
  const tickerAbortRef = useRef<AbortController | null>(null);
  const tickerBusyRef = useRef(false);

  const resolvedRole = forcedRole ?? resolveWorkspaceRole(user);
  const role = resolveWorkspaceSurfaceRole(pathname ?? '/', resolvedRole);
  const definition = definitionOverride ?? getWorkspaceDefinition(role);
  const nav = useMemo(
    () =>
      (definitionOverride?.nav ?? getVisibleWorkspaceNav(role))
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.capability || hasWorkspaceCapability(role, item.capability)),
        }))
        .filter((group) => group.items.length > 0),
    [definitionOverride?.nav, role],
  );
  const navigationTargets = useMemo(
    () =>
      nav.flatMap((group) =>
        group.items.map((item) => ({
          id: `${group.id}-${item.id}`,
          label: item.label,
          href: item.href,
        })),
      ),
    [nav],
  );
  const actionRole = resolveActionCentreRole(role);
  const notificationsHref = fixtureOverrides?.notificationsHref ?? getNotificationsRoute(actionRole);
  const actionCentreHref = fixtureOverrides?.actionCentreHref ?? getActionCentreRoute(actionRole);
  const fixtureMode = Boolean(fixtureOverrides);

  useEffect(() => {
    setHydrated(true);
    const update = () => {
      setIsCompact(window.innerWidth <= WORKSPACE_SHELL_BREAKPOINTS.compactMaxWidth);
      setIsMobile(window.innerWidth <= WORKSPACE_SHELL_BREAKPOINTS.mobileMaxWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (fixtureOverrides?.companyName) {
      setCompanyName(fixtureOverrides.companyName);
      return;
    }
    if (!user?.companyId || !isSupabaseConfigured) {
      if (role === 'customer') setCompanyName('Customer Account');
      else if (role === 'broker') setCompanyName('Broker Company');
      else if (role === 'driver' || role === 'owner_driver') {
        setCompanyName(user?.email ?? 'Driver Account');
      }
      return;
    }

    let cancelled = false;
    supabase
      .from('companies')
      .select('name')
      .eq('id', user.companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && typeof data?.name === 'string' && data.name.trim()) {
          setCompanyName(data.name);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fixtureOverrides?.companyName, role, user?.companyId, user?.email]);

  useEffect(() => {
    if (typeof fixtureOverrides?.unreadCount === 'number') {
      setUnreadCount(fixtureOverrides.unreadCount);
      return;
    }
    if (!user?.id || !isSupabaseConfigured) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notification_events')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .in('status', ['pending', 'failed']);
      setUnreadCount(count ?? 0);
    };

    void fetchUnread();
    const timer = window.setInterval(() => void fetchUnread(), 60_000);
    return () => window.clearInterval(timer);
  }, [actionCentreHref, actionRole, fixtureOverrides?.unreadCount, role, user?.id]);

  useEffect(() => {
    if (fixtureOverrides?.tickerItems || fixtureOverrides?.tickerError) {
      setTickerItems(fixtureOverrides.tickerItems ?? []);
      setTickerError(fixtureOverrides.tickerError ?? '');
      return;
    }
    if (!user?.id || !isSupabaseConfigured) {
      setTickerItems([]);
      setTickerError('');
      return;
    }

    let cancelled = false;
    const clearTimer = () => {
      if (tickerTimerRef.current !== null) {
        window.clearTimeout(tickerTimerRef.current);
        tickerTimerRef.current = null;
      }
    };
    const queueNext = (ms = 30_000) => {
      clearTimer();
      tickerTimerRef.current = window.setTimeout(() => {
        void fetchTicker();
      }, ms);
    };

    const fetchTicker = async (force = false) => {
      if (cancelled) return;
      if (!force && document.visibilityState !== 'visible') {
        queueNext(5_000);
        return;
      }
      if (tickerBusyRef.current) {
        queueNext(5_000);
        return;
      }

      tickerBusyRef.current = true;
      tickerAbortRef.current?.abort();
      const controller = new AbortController();
      tickerAbortRef.current = controller;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setTickerItems([]);
          setTickerError('');
          return;
        }

        const response = await fetch('/api/workspace/activity-feed?limit=12', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          setTickerItems([]);
          setTickerError('Activity feed unavailable');
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as {
          items?: Array<{
            id: string;
            label: string;
            reference: string | null;
            created_at: string;
            entity_type?: string | null;
            entity_id?: string | null;
            event_id?: string | null;
          }>;
        };
        const items = Array.isArray(payload.items) ? payload.items : [];
        setTickerError('');
        const withHrefs = items
          .slice()
          .reverse()
          .map((item) => ({
            ...item,
            href: resolveRoleScopedHref(actionRole, item.entity_type, item.event_id),
          }));
        setTickerItems(withHrefs);
      } catch {
        setTickerItems([]);
        setTickerError('Activity feed unavailable');
      } finally {
        tickerBusyRef.current = false;
        if (!cancelled) queueNext();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchTicker(true);
      } else {
        clearTimer();
        tickerAbortRef.current?.abort();
      }
    };

    void fetchTicker(true);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      clearTimer();
      tickerAbortRef.current?.abort();
      tickerBusyRef.current = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [actionCentreHref, actionRole, fixtureOverrides?.tickerError, fixtureOverrides?.tickerItems, role, user?.id]);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const isActive = (href: string) => {
    const [baseHref] = href.split('?');
    if (baseHref === definition.homeHref) return pathname === baseHref;
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  };

  const primaryAction =
    definition.primaryAction &&
    (!definition.primaryAction.capability ||
      hasWorkspaceCapability(role, definition.primaryAction.capability))
      ? definition.primaryAction
      : null;

  if (!hydrated) {
    return <div style={{ minHeight: '100vh', background: workspaceTheme.page }} />;
  }

  const sidebarStyle: CSSProperties = {
    /* Section 2: 230px desktop; 56px tablet (collapsed, icon-only); 280px mobile drawer */
    width: isMobile
      ? workspaceShellPx(WORKSPACE_SHELL_DIMENSIONS.mobileDrawer)
      : isCompact
        ? workspaceShellPx(WORKSPACE_SHELL_DIMENSIONS.compactSidebar)
        : workspaceShellPx(WORKSPACE_SHELL_DIMENSIONS.desktopSidebar),
    background: '#ffffff',
    borderRight: `1px solid ${workspaceTheme.border}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    /* Mobile: fixed off-canvas drawer; tablet/desktop: sticky in flow */
    position: isMobile ? 'fixed' : 'sticky',
    top: 0,
    left: 0,
    zIndex: 60,
    flexShrink: 0,
    /* Only slide off-canvas for mobile drawer */
    transform: isMobile
      ? sidebarOpen
        ? 'translateX(0)'
        : 'translateX(-100%)'
      : 'none',
    transition: 'transform 0.2s ease',
    overflowX: 'hidden',
  };

  return (
    <div
      className={styles.workspaceRoot}
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: workspaceTheme.page,
        color: workspaceTheme.text,
      }}
    >
      {/* Mobile drawer overlay — Section 2: opacity 0.42, only on mobile */}
      {isMobile && sidebarOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            border: 0,
            background: 'rgba(0,0,0,0.42)',
            zIndex: 50,
            cursor: 'pointer',
          }}
        />
      )}

      <aside style={sidebarStyle} aria-label={`${definition.label} navigation`}>
        {/* Logo/header area — Section 2: 50px high */}
        <div
          style={{
            minHeight: workspaceShellPx(WORKSPACE_SHELL_DIMENSIONS.headerHeight),
            height: workspaceShellPx(WORKSPACE_SHELL_DIMENSIONS.headerHeight),
            padding: isCompact ? '0' : '0 12px',
            background: '#fff',
            borderBottom: `1px solid ${workspaceTheme.border}`,
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => router.push(definition.homeHref)}
            style={{
              border: 0,
              background: 'transparent',
              padding: 0,
              width: '100%',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              /* When collapsed: center the icon in 56px */
              justifyContent: isCompact ? 'center' : 'flex-start',
            }}
          >
            {isCompact ? (
              <Image
                src="/icon-192.png"
                alt="XDrive Logistics"
                width={32}
                height={32}
                priority
                style={{ borderRadius: '4px', flexShrink: 0 }}
              />
            ) : (
              <Image
                src="/xdrive-logo-primary.png"
                alt="XDrive Logistics"
                width={150}
                height={41}
                priority
                style={{ width: '150px', height: '41px', objectFit: 'contain', objectPosition: 'left center' }}
              />
            )}
          </button>
        </div>

        {/* Navigation — Section 2: scrollbar 8px; group top-margin 12px */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0', scrollbarWidth: 'thin', scrollbarColor: '#D8DEE8 transparent' }}>
          {nav.map((group, groupIndex) => (
            <div key={group.id} style={{ marginTop: groupIndex === 0 ? '8px' : '12px', marginBottom: '0' }}>
              {/* Group heading — Section 2: 11px/700/uppercase; line-height 16px; bottom-margin 4px.
                  Hidden in collapsed tablet mode (56px). */}
              {!isCompact && (
                <div
                  style={{
                    padding: '0 10px',
                    marginBottom: '4px',
                    color: '#64748b',
                    fontSize: '11px',
                    fontWeight: 700,
                    lineHeight: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {group.label}
                </div>
              )}
              <div style={{ display: 'grid', gap: '2px', padding: '0 4px' }}>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  /* Collapsed tablet mode (56px): icon centred, no label */
                  if (isCompact) {
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          router.push(item.href);
                          if (isMobile) setSidebarOpen(false);
                        }}
                        title={item.label}
                        aria-label={item.label}
                        style={{
                          width: '100%',
                          height: '34px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 0,
                          /* Section 2: selected indicator 3px left border; radius 2px */
                          borderLeft: active
                            ? `3px solid ${workspaceTheme.blue}`
                            : '3px solid transparent',
                          borderRadius: '2px',
                          background: active ? '#eff6ff' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        {/* Section 2: icon box 18×18px */}
                        <span
                          aria-hidden="true"
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '3px',
                            display: 'grid',
                            placeItems: 'center',
                            background: active ? '#dbeafe' : '#eef2f6',
                            color: active ? workspaceTheme.blue : '#475569',
                            fontSize: item.icon === 'OC' ? '0.58rem' : '0.7rem',
                            fontWeight: 900,
                            flexShrink: 0,
                          }}
                        >
                          {item.icon ?? '•'}
                        </span>
                      </button>
                    );
                  }
                  /* Full sidebar mode (desktop / mobile drawer): show icon + label */
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        router.push(item.href);
                        if (isMobile) setSidebarOpen(false);
                      }}
                      style={{
                        width: '100%',
                        /* Section 2: nav item height 34px; h-padding 10px */
                        height: '34px',
                        display: 'grid',
                        /* Section 2: icon-to-label gap 8px; icon box 18×18px */
                        gridTemplateColumns: '18px minmax(0,1fr) 6px',
                        alignItems: 'center',
                        gap: '8px',
                        border: 0,
                        /* Section 2: selected indicator 3px left border; radius 2px (not pill) */
                        borderLeft: active
                          ? `3px solid ${workspaceTheme.blue}`
                          : '3px solid transparent',
                        borderRadius: '2px',
                        background: active ? '#eff6ff' : 'transparent',
                        color: active ? workspaceTheme.blue : workspaceTheme.text,
                        padding: '0 10px',
                        fontSize: '13px',
                        fontWeight: active ? 600 : 400,
                        textAlign: 'left',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Section 2: icon box 18×18px */}
                      <span
                        aria-hidden="true"
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '3px',
                          display: 'grid',
                          placeItems: 'center',
                          background: active ? '#dbeafe' : '#eef2f6',
                          color: active ? workspaceTheme.blue : '#475569',
                          fontSize: item.icon === 'OC' ? '0.58rem' : '0.7rem',
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        {item.icon ?? '•'}
                      </span>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </span>
                      {active ? (
                        <span
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: workspaceTheme.blue,
                          }}
                        />
                      ) : (
                        <span />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer — hidden in collapsed (tablet) mode, shown in desktop/mobile-drawer */}
        {!isCompact && (
        <div
          style={{
            padding: '12px',
            borderTop: `1px solid ${workspaceTheme.border}`,
            background: '#fff',
          }}
        >
          <div
            style={{
              color: workspaceTheme.muted,
              fontSize: '11px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '8px',
            }}
          >
            {user?.email ?? ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => router.push(definition.homeHref)}
              style={{
                border: `1px solid ${workspaceTheme.border}`,
                borderRadius: '4px',
                background: '#fff',
                color: workspaceTheme.text,
                padding: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Home
            </button>
            <button
              onClick={() => void logout()}
              style={{
                border: '1px solid #fecaca',
                borderRadius: '4px',
                background: '#fff',
                color: workspaceTheme.red,
                padding: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        )}
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            minHeight: workspaceShellPx(WORKSPACE_SHELL_DIMENSIONS.headerHeight),
            height: workspaceShellPx(WORKSPACE_SHELL_DIMENSIONS.headerHeight),
            background: '#fff',
            borderBottom: `1px solid ${workspaceTheme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            position: 'sticky',
            top: 0,
            zIndex: 35,
            gap: '12px',
            flexWrap: 'nowrap',
            overflow: 'hidden',
            boxShadow: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {/* Hamburger only for mobile off-canvas; tablet keeps 56px icon sidebar */}
            {isMobile && (
              <button
                aria-label="Open menu"
                onClick={() => setSidebarOpen(true)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: `1px solid ${workspaceTheme.border}`,
                  borderRadius: '4px',
                  background: '#fff',
                  color: workspaceTheme.text,
                  fontSize: '13px',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                ☰
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: workspaceTheme.muted, fontWeight: 600 }}>
                {definition.label}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: workspaceTheme.text,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {companyName}
              </div>
            </div>
          </div>

          {!isMobile && (
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              {fixtureMode ? (
                <div
                  aria-label="Workspace context controls"
                  style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}
                >
                  <span
                    aria-label="Active organisation"
                    style={{
                      height: '32px',
                      border: `1px solid ${workspaceTheme.border}`,
                      borderRadius: '4px',
                      background: '#fff',
                      color: workspaceTheme.text,
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '0 0.55rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    {companyName}
                  </span>
                </div>
              ) : (
                <SharedContextControls navigation={navigationTargets} />
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {primaryAction && (
              <button
                onClick={() => router.push(primaryAction.href)}
                style={{
                  border: 0,
                  background: workspaceTheme.orange,
                  color: '#172033',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'none',
                }}
              >
                + {primaryAction.label}
              </button>
            )}
            <button
              onClick={() => router.push(actionCentreHref)}
              data-route={actionCentreHref}
              style={{
                border: `1px solid ${workspaceTheme.border}`,
                borderRadius: '4px',
                background: '#fff',
                color: workspaceTheme.text,
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Action Centre
            </button>
            <button
              onClick={() => router.push(notificationsHref)}
              title="Notifications"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              data-route={notificationsHref}
              style={{
                position: 'relative',
                width: '32px',
                height: '32px',
                border: `1px solid ${workspaceTheme.border}`,
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 3px',
                    borderRadius: '999px',
                    background: workspaceTheme.red,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.55rem',
                    fontWeight: 900,
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>
        <WorkspaceActivityFeed
          items={tickerItems}
          error={tickerError}
          classNames={{
            root: styles.tickerRoot,
            title: styles.tickerLabel,
            track: styles.tickerTrack,
            item: styles.tickerItem,
            time: styles.tickerTime,
            error: styles.tickerError,
          }}
          labelColor={workspaceTheme.orange}
          timeColor={workspaceTheme.orange}
          background={workspaceTheme.navy}
          onItemClick={(href) => router.push(href)}
        />
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
