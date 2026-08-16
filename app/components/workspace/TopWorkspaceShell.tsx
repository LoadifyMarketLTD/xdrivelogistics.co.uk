'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getVisibleWorkspaceNav,
  getWorkspaceDefinition,
  hasWorkspaceCapability,
  resolveWorkspaceRole,
  resolveWorkspaceSurfaceRole,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';
import SharedContextControls from './SharedContextControls';
import {
  getActionCentreRoute,
  getNotificationsRoute,
  resolveActionCentreRole,
} from './actionCentreConfig';

const FREIGHT_VISION_ROLES = new Set<WorkspaceRole>([
  'company_owner',
  'company_admin',
  'carrier_admin',
  'fleet_manager',
  'dispatcher',
]);

const FLEET_OPERATION_ROLES = new Set<WorkspaceRole>([
  'company_owner',
  'company_admin',
  'carrier_admin',
  'fleet_manager',
  'dispatcher',
]);

const CARRIER_NAV_ROLES = new Set<WorkspaceRole>([
  'company_owner',
  'company_admin',
  'carrier_admin',
]);

export default function TopWorkspaceShell({
  children,
  forcedRole,
}: {
  children: ReactNode;
  forcedRole?: WorkspaceRole;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const resolvedRole = forcedRole ?? resolveWorkspaceRole(user);
  const role = resolveWorkspaceSurfaceRole(pathname ?? '/', resolvedRole);
  const definition = getWorkspaceDefinition(role);
  const nav = useMemo(() => {
    const base = getVisibleWorkspaceNav(role).map((group) => ({ ...group, items: [...group.items] }));

    if (FREIGHT_VISION_ROLES.has(role) && hasWorkspaceCapability(role, 'jobs.track')) {
      const item = {
        id: 'freight-vision',
        label: 'Freight Vision',
        href: '/admin/freight-vision',
        icon: '⌖',
        capability: 'jobs.track' as const,
      };
      const alreadyPresent = base.some((group) => group.items.some((candidate) => candidate.href === item.href));
      if (!alreadyPresent) {
        if (CARRIER_NAV_ROLES.has(role)) {
          const financeIndex = base.findIndex((group) => group.id === 'carrier-finance');
          const insertAt = financeIndex >= 0 ? financeIndex : base.length;
          base.splice(insertAt, 0, { id: 'carrier-freight-vision', label: 'Freight Vision', items: [item] });
        } else {
          const operations = base.find((group) => group.id === 'operations');
          if (operations) operations.items.push(item);
          else base.push({ id: 'operations', label: 'Operations', items: [item] });
        }
      }
    }

    if (FLEET_OPERATION_ROLES.has(role) && hasWorkspaceCapability(role, 'fleet.positions.view')) {
      const items = [
        {
          id: 'live-availability',
          label: 'Live Availability',
          href: '/admin/live-availability',
          icon: '◷',
          capability: 'fleet.positions.view' as const,
        },
        {
          id: 'fleet-resources',
          label: 'Fleet Resources',
          href: '/admin/fleet/resources',
          icon: '▦',
          capability: 'fleet.positions.view' as const,
        },
      ];

      if (CARRIER_NAV_ROLES.has(role)) {
        const carrierFleet = base.find((group) => group.id === 'carrier-fleet');
        if (carrierFleet) {
          for (const item of items) {
            if (!carrierFleet.items.some((candidate) => candidate.href === item.href)) carrierFleet.items.push(item);
          }
        } else {
          base.push({ id: 'carrier-fleet', label: 'Fleet', items });
        }
      } else {
        const fleet = base.find((group) => group.id === 'fleet');
        if (fleet) {
          for (const item of items) {
            if (!fleet.items.some((candidate) => candidate.href === item.href)) fleet.items.push(item);
          }
        } else {
          base.push({ id: 'fleet', label: 'Fleet', items });
        }
      }
    }

    return base;
  }, [role]);
  const [companyName, setCompanyName] = useState('XDrive Logistics');
  const [unreadCount, setUnreadCount] = useState(0);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);

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

  const activeNavigationHref = useMemo(() => {
    const current = pathname ?? '/';
    if (current === definition.homeHref) return definition.homeHref;

    const candidates = navigationTargets
      .map((target) => target.href.split('?')[0] ?? target.href)
      .filter((href) => href !== definition.homeHref)
      .filter((href) => current === href || current.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length);

    return candidates[0] ?? null;
  }, [definition.homeHref, navigationTargets, pathname]);

  const actionRole = resolveActionCentreRole(role);
  const actionCentreHref = getActionCentreRoute(actionRole);
  const notificationsHref = getNotificationsRoute(actionRole);
  const primaryAction =
    definition.primaryAction &&
    (!definition.primaryAction.capability ||
      hasWorkspaceCapability(role, definition.primaryAction.capability))
      ? definition.primaryAction
      : null;

  useEffect(() => {
    if (!user?.companyId || !isSupabaseConfigured) {
      if (role === 'customer') setCompanyName('Customer Account');
      else if (role === 'broker') setCompanyName('Broker Company');
      else setCompanyName(user?.email ?? definition.label);
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
          setCompanyName(data.name.trim());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [definition.label, role, user?.companyId, user?.email]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notification_events')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .in('status', ['pending', 'failed']);
      if (!cancelled) setUnreadCount(count ?? 0);
    };

    void fetchUnread();
    const timer = window.setInterval(() => void fetchUnread(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    setOpenGroupId(null);
    setContextOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenGroupId(null);
        setContextOpen(false);
      }
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (navRef.current && !navRef.current.contains(event.target)) setOpenGroupId(null);
      if (contextRef.current && !contextRef.current.contains(event.target)) setContextOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, []);

  const isActive = (href: string) => {
    const [baseHref] = href.split('?');
    return baseHref === activeNavigationHref;
  };

  const openRoute = (href: string) => {
    setOpenGroupId(null);
    setContextOpen(false);
    router.push(href);
  };

  return (
    <div className="top-workspace-shell">
      <header className="top-workspace-shell__header">
        <div className="top-workspace-shell__brand">
          <button
            type="button"
            className="top-workspace-shell__logo-button"
            onClick={() => router.push(definition.homeHref)}
            aria-label={`Open ${definition.label}`}
          >
            <Image
              src="/xdrive-logo-primary.png"
              alt="XDrive Logistics"
              width={150}
              height={41}
              priority
              className="top-workspace-shell__logo"
            />
          </button>
          <div className="top-workspace-shell__identity">
            <span>{definition.label}</span>
            <strong>{companyName}</strong>
          </div>
        </div>

        <nav
          ref={navRef}
          className="top-workspace-nav top-workspace-nav--inline"
          aria-label={`${definition.label} navigation`}
        >
          <div className="top-workspace-nav__track">
            {nav.map((group, groupIndex) => {
              const groupActive = group.items.some((item) => isActive(item.href));

              if (group.items.length === 1) {
                const item = group.items[0];
                const active = isActive(item.href);
                return (
                  <div
                    key={group.id}
                    className="top-workspace-nav__group"
                    data-first={groupIndex === 0 ? 'true' : 'false'}
                  >
                    <button
                      type="button"
                      className="top-workspace-nav__item"
                      data-active={active ? 'true' : 'false'}
                      onClick={() => openRoute(item.href)}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </button>
                  </div>
                );
              }

              const open = openGroupId === group.id;
              return (
                <div
                  key={group.id}
                  className="top-workspace-nav__group top-workspace-nav__group--menu"
                  data-first={groupIndex === 0 ? 'true' : 'false'}
                >
                  <button
                    type="button"
                    className="top-workspace-nav__item top-workspace-nav__trigger"
                    data-active={groupActive ? 'true' : 'false'}
                    data-open={open ? 'true' : 'false'}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    onClick={() => {
                      setContextOpen(false);
                      setOpenGroupId(open ? null : group.id);
                    }}
                  >
                    <span>{group.label}</span>
                    <span aria-hidden="true" className="top-workspace-nav__caret">▾</span>
                  </button>
                  {open && (
                    <div className="top-workspace-nav__menu" role="menu" aria-label={group.label}>
                      {group.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            className="top-workspace-nav__menu-item"
                            data-active={active ? 'true' : 'false'}
                            onClick={() => openRoute(item.href)}
                          >
                            <span className="top-workspace-nav__menu-icon" aria-hidden="true">
                              {item.icon ?? '•'}
                            </span>
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="top-workspace-shell__actions">
          <div ref={contextRef} className="top-workspace-context">
            <button
              type="button"
              className="top-workspace-action top-workspace-action--context"
              aria-expanded={contextOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setOpenGroupId(null);
                setContextOpen((open) => !open);
              }}
            >
              Workspace
            </button>
            {contextOpen && (
              <div className="top-workspace-context__menu" role="dialog" aria-label="Workspace context and navigation">
                <SharedContextControls navigation={navigationTargets} />
              </div>
            )}
          </div>
          {primaryAction && (
            <button
              type="button"
              className="top-workspace-action top-workspace-action--primary"
              onClick={() => router.push(primaryAction.href)}
            >
              + {primaryAction.label}
            </button>
          )}
          <button
            type="button"
            className="top-workspace-action"
            onClick={() => router.push(actionCentreHref)}
          >
            Action Centre
          </button>
          <button
            type="button"
            className="top-workspace-notification"
            onClick={() => router.push(notificationsHref)}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            title="Notifications"
          >
            <span aria-hidden="true">🔔</span>
            {unreadCount > 0 && (
              <span className="top-workspace-notification__count">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="top-workspace-action top-workspace-action--signout"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="top-workspace-shell__content">{children}</main>
    </div>
  );
}
