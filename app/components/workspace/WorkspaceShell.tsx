'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getVisibleWorkspaceNav,
  getWorkspaceDefinition,
  hasWorkspaceCapability,
  resolveWorkspaceSurfaceRole,
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
import styles from './WorkspaceShell.module.css';

type WorkspaceShellFixtureOverrides = {
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
}: {
  children: ReactNode;
  forcedRole?: WorkspaceRole;
  fixtureOverrides?: WorkspaceShellFixtureOverrides;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState<string>('XDrive Logistics');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [tickerItems, setTickerItems] = useState<Array<{ id: string; label: string; reference: string | null; created_at: string; href?: string | null }>>([]);
  const [tickerError, setTickerError] = useState('');
  const tickerTimerRef = useRef<number | null>(null);
  const tickerAbortRef = useRef<AbortController | null>(null);
  const tickerBusyRef = useRef(false);

  const resolvedRole = forcedRole ?? resolveWorkspaceRole(user);
  const role = resolveWorkspaceSurfaceRole(pathname ?? '/', resolvedRole);
  const definition = getWorkspaceDefinition(role);
  const nav = useMemo(() => getVisibleWorkspaceNav(role), [role]);
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
    const update = () => setIsCompact(window.innerWidth <= 1024);
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
    if (!isCompact) setSidebarOpen(false);
  }, [isCompact]);

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
    width: '230px',
    background: '#ffffff',
    borderRight: `1px solid ${workspaceTheme.border}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: isCompact ? 'fixed' : 'sticky',
    top: 0,
    left: 0,
    zIndex: 60,
    flexShrink: 0,
    transform: isCompact
      ? sidebarOpen
        ? 'translateX(0)'
        : 'translateX(-100%)'
      : 'none',
    transition: 'transform 0.2s ease',
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
      {isCompact && sidebarOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            border: 0,
            background: 'rgba(15,23,42,0.55)',
            zIndex: 50,
            cursor: 'pointer',
          }}
        />
      )}

      <aside style={sidebarStyle} aria-label={`${definition.label} navigation`}>
        <div
          style={{
            padding: '12px',
            background: '#fff',
            borderBottom: `1px solid ${workspaceTheme.border}`,
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
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '4px',
                  background: workspaceTheme.navy,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: 'none',
                }}
              >
                <span style={{ color: workspaceTheme.orange, fontWeight: 950, fontSize: '1rem' }}>
                  X
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: workspaceTheme.text,
                    fontSize: '13px',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {companyName}
                </div>
                <div
                  style={{
                    color: workspaceTheme.muted,
                    fontSize: '11px',
                    marginTop: '0.08rem',
                  }}
                >
                  {definition.subtitle}
                </div>
              </div>
            </div>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.32rem',
              marginTop: '8px',
              flexWrap: 'nowrap',
            }}
          >
            <span
              style={{
                fontSize: '0.59rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#92400e',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              {definition.label}
            </span>
            {role !== 'driver' &&
              role !== 'customer' &&
              role !== 'broker' &&
              role !== 'owner_driver' && (
                <span
                  style={{
                    fontSize: '0.59rem',
                    fontWeight: 600,
                    color: '#1e40af',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  Company View
                </span>
              )}
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {nav.map((group) => (
            <div key={group.id} style={{ marginBottom: '8px' }}>
              <div
                style={{
                  padding: '4px 8px',
                  color: '#64748b',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {group.label}
              </div>
              <div style={{ display: 'grid', gap: '4px' }}>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        router.push(item.href);
                        if (isCompact) setSidebarOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: '26px minmax(0,1fr) 7px',
                        alignItems: 'center',
                        gap: '8px',
                        border: 0,
                        borderLeft: active
                          ? `3px solid ${workspaceTheme.blue}`
                          : '3px solid transparent',
                        borderRadius: '4px',
                        background: active ? '#eff6ff' : 'transparent',
                        color: active ? workspaceTheme.blue : workspaceTheme.text,
                        padding: '8px',
                        fontSize: '13px',
                        fontWeight: active ? 600 : 400,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          display: 'grid',
                          placeItems: 'center',
                          background: active ? '#dbeafe' : '#eef2f6',
                          color: active ? workspaceTheme.blue : '#475569',
                          fontSize: item.icon === 'OC' ? '0.6rem' : '0.78rem',
                          fontWeight: 900,
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
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            minHeight: '50px',
            height: '50px',
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
            {isCompact && (
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

          {!isCompact && (
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
