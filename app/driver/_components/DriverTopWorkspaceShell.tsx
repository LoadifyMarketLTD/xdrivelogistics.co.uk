'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAuth } from '../../components/AuthContext';
import { getNotificationsRoute, resolveActionCentreRole } from '../../components/workspace/actionCentreConfig';
import { workspaceTheme } from '../../components/workspace/WorkspaceUI';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

const DRIVER_PRIMARY_NAV = [
  { id: 'dashboard', label: 'Dashboard', href: '/driver' },
  { id: 'directory', label: 'Directory', href: '/driver/directory' },
  { id: 'availability', label: 'Live Availability', href: '/driver/nearby' },
  { id: 'fleet', label: 'My Fleet', href: '/driver/vehicles' },
  { id: 'returns', label: 'Return Journeys', href: '/driver/returns' },
  { id: 'loads', label: 'Loads', href: '/driver/loads' },
  { id: 'quotes', label: 'Quotes', href: '/driver/quotes' },
  { id: 'diary', label: 'Diary', href: '/driver/history' },
  { id: 'vision', label: 'Freight Vision', href: '/driver/freight-vision' },
  { id: 'finance', label: 'Finance', href: '/driver/finance' },
  { id: 'drivers', label: 'Drivers & Vehicles', href: '/driver/drivers-vehicles' },
] as const;

const DRIVER_SETTINGS_MENU = [
  { label: 'Overview', href: '/driver/settings?section=overview', ownerOnly: true },
  { label: 'My Profile', href: '/driver/profile' },
  { label: 'Company Profile', href: '/driver/settings?section=company', ownerOnly: true },
  { label: 'Drivers / Staff', href: '/driver/drivers-vehicles', ownerOnly: true },
  { label: 'Vehicle', href: '/driver/vehicles' },
  { label: 'Documents', href: '/driver/documents' },
  { label: 'Billing & Membership', href: '/settings/billing', ownerOnly: true },
  { label: 'Notifications', href: '/driver/notifications' },
  { label: 'Security', href: '/driver/change-password' },
  { label: 'Audit / Event Log', href: '/driver/event-log' },
  { label: 'Support', href: '/help' },
] as const;

const DRIVER_COMMERCIAL_NAV_IDS = new Set(['directory', 'availability', 'returns', 'loads', 'quotes']);
const DRIVER_OWNER_ONLY_NAV_IDS = new Set(['finance', 'drivers']);

export default function DriverTopWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.ownerDriverWorkspace ? 'owner_driver' as const : 'driver' as const;
  const [companyName, setCompanyName] = useState('Driver Account');
  const [unreadCount, setUnreadCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const actionRole = resolveActionCentreRole(role);
  const notificationsHref = getNotificationsRoute(actionRole);
  const commercialAccess = role === 'owner_driver' || user?.canCommercialBid === true;
  const primaryNav = DRIVER_PRIMARY_NAV.filter((item) => {
    if (role === 'owner_driver') return true;
    if (DRIVER_OWNER_ONLY_NAV_IDS.has(item.id)) return false;
    if (DRIVER_COMMERCIAL_NAV_IDS.has(item.id)) return commercialAccess;
    return true;
  });
  const settingsMenu = DRIVER_SETTINGS_MENU.filter((item) => role === 'owner_driver' || !('ownerOnly' in item && item.ownerOnly === true));

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
    setSettingsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const fetchUnread = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        if (!cancelled) setUnreadCount(0);
        return;
      }
      const response = await fetch('/api/driver/notifications', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!response.ok) {
        if (!cancelled) setUnreadCount(0);
        return;
      }
      const payload = await response.json().catch(() => ({})) as {
        notifications?: Array<{ read_at?: string | null }>;
      };
      if (!cancelled) {
        setUnreadCount((payload.notifications ?? []).filter((notification) => !notification.read_at).length);
      }
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
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="driver-top-shell driver-prototype-port">
      <header className="topbar">
        <div className="brand">
          <button type="button" className="driver-prototype-brand-button" onClick={() => router.push('/driver')} aria-label="Open Driver dashboard">
            <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={160} height={44} priority />
          </button>
        </div>
        {role === 'owner_driver' && <button type="button" className="cta post" onClick={() => router.push('/driver/post-load')}>POST LOAD</button>}
        {commercialAccess && <button type="button" className="cta direct" onClick={() => router.push('/driver/directory')}>BOOK DIRECT</button>}
        <nav className="main-nav" aria-label="Driver workspace navigation">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            const label = role === 'driver' && item.id === 'fleet' ? 'Vehicle' : item.label;
            return <button key={item.id} type="button" className={active ? 'active' : ''} onClick={() => router.push(item.href)} aria-current={active ? 'page' : undefined}>{label}</button>;
          })}
        </nav>
        <div className="top-tools">
          <button type="button" onClick={() => router.push('/driver/messages')}>Messages</button>
          <button type="button" onClick={() => router.push(notificationsHref)}>Alerts {unreadCount > 0 && <b className="notif">{unreadCount > 99 ? '99+' : unreadCount}</b>}</button>
          <div className="driver-settings-menu">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              Settings
            </button>
            {settingsOpen && (
              <div className="driver-settings-menu__panel" role="menu" aria-label="Driver settings">
                {settingsMenu.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSettingsOpen(false);
                      router.push(item.href);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="avatar account-toggle" onClick={() => router.push('/driver/account')} aria-label="Open account">{(companyName || 'DR').slice(0, 2).toUpperCase()}</button>
        </div>
      </header>
      <main className="app driver-prototype-app" style={{ background: workspaceTheme.page }}>{children}</main>
    </div>
  );
}
