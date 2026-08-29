'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAuth } from '../../components/AuthContext';
import {
  getActionCentreRoute,
  getNotificationsRoute,
  resolveActionCentreRole,
} from '../../components/workspace/actionCentreConfig';
import { workspaceTheme } from '../../components/workspace/WorkspaceUI';
import {
  getWorkspaceDefinition,
  hasWorkspaceCapability,
} from '../../../lib/workspaceRole';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

const DRIVER_PRIMARY_NAV = [
  { id: 'dashboard', label: 'Dashboard', href: '/driver' },
  { id: 'directory', label: 'Directory', href: '/driver/directory' },
  { id: 'returns', label: 'Return Journeys', href: '/driver/returns' },
  { id: 'loads', label: 'Loads', href: '/driver/loads' },
  { id: 'quotes', label: 'Quotes', href: '/driver/quotes' },
  { id: 'diary', label: 'Diary', href: '/driver/history' },
  { id: 'event-log', label: 'Event Log', href: '/driver/event-log' },
] as const;

const DRIVER_MORE_NAV = [
  { id: 'jobs', label: 'Jobs', href: '/driver/jobs' },
  { id: 'availability', label: 'Availability', href: '/driver/availability' },
  { id: 'nearby', label: "Who's Nearby?", href: '/driver/nearby' },
  { id: 'messages', label: 'Messages', href: '/driver/messages' },
  { id: 'vehicle', label: 'Vehicle', href: '/driver/vehicles' },
  { id: 'documents', label: 'Documents', href: '/driver/documents' },
  { id: 'invoices', label: 'Invoices', href: '/driver/finance' },
  { id: 'notifications', label: 'Notifications', href: '/driver/notifications' },
  { id: 'account', label: 'Account', href: '/driver/account' },
] as const;

const ACCOUNT_PREFIXES = [
  '/driver/account',
  '/driver/profile',
  '/driver/change-password',
] as const;

export default function DriverTopWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = 'driver' as const;
  const definition = getWorkspaceDefinition(role);
  const [companyName, setCompanyName] = useState('Driver Account');
  const [unreadCount, setUnreadCount] = useState(0);

  const actionRole = resolveActionCentreRole(role);
  const actionCentreHref = getActionCentreRoute(actionRole);
  const notificationsHref = getNotificationsRoute(actionRole);
  const primaryAction =
    definition.primaryAction &&
    (!definition.primaryAction.capability || hasWorkspaceCapability(role, definition.primaryAction.capability))
      ? definition.primaryAction
      : null;

  useEffect(() => {
    if (!user?.companyId || !isSupabaseConfigured) {
      setCompanyName(user?.email ?? 'Driver Account');
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

    return () => { cancelled = true; };
  }, [user?.companyId, user?.email]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (!cancelled) setUnreadCount(count ?? 0);
    };

    void fetchUnread();
    const timer = window.setInterval(() => void fetchUnread(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  const isActive = (href: string) => {
    if (href === '/driver') return pathname === '/driver';
    if (href === '/driver/account') {
      return ACCOUNT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const moreActive = DRIVER_MORE_NAV.some((item) => isActive(item.href));

  return (
    <div className="driver-top-shell">
      <header className="driver-top-shell__header">
        <div className="driver-top-shell__brand">
          <button type="button" className="driver-top-shell__logo-button" onClick={() => router.push(definition.homeHref)} aria-label="Open Driver dashboard">
            <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={150} height={41} priority className="driver-top-shell__logo" />
          </button>
          <div className="driver-top-shell__identity"><span>{definition.label}</span><strong>{companyName}</strong></div>
        </div>

        <nav className="driver-top-nav" aria-label="Driver workspace navigation">
          <div className="driver-top-nav__track">
            {DRIVER_PRIMARY_NAV.map((item) => {
              const active = isActive(item.href);
              return <button key={item.id} type="button" className="driver-top-nav__item" data-active={active ? 'true' : 'false'} onClick={() => router.push(item.href)} aria-current={active ? 'page' : undefined}>{item.label}</button>;
            })}
            <details className="driver-top-nav__more">
              <summary className="driver-top-nav__item driver-top-nav__more-trigger" data-active={moreActive ? 'true' : 'false'}>More <span aria-hidden="true">▾</span></summary>
              <div className="driver-top-nav__more-menu" role="menu" aria-label="More Driver workspace options">
                {DRIVER_MORE_NAV.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className="driver-top-nav__more-item"
                    data-active={isActive(item.href) ? 'true' : 'false'}
                    onClick={(event) => {
                      const details = event.currentTarget.closest('details');
                      if (details) details.removeAttribute('open');
                      router.push(item.href);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </details>
          </div>
        </nav>

        <div className="driver-top-shell__actions">
          {primaryAction && <button type="button" className="driver-shell-action driver-shell-action--primary" onClick={() => router.push(primaryAction.href)}>+ {primaryAction.label}</button>}
          <button type="button" className="driver-shell-action" onClick={() => router.push(actionCentreHref)}>Action Centre</button>
          <button type="button" className="driver-shell-notification" onClick={() => router.push(notificationsHref)} aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`} title="Notifications">
            <span aria-hidden="true">🔔</span>
            {unreadCount > 0 && <span className="driver-shell-notification__count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          <button type="button" className="driver-shell-action driver-shell-action--signout" onClick={() => void logout()}>Sign out</button>
        </div>
      </header>

      <main className="driver-top-shell__content" style={{ background: workspaceTheme.page }}>{children}</main>
    </div>
  );
}
