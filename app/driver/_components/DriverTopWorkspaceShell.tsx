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

export default function DriverTopWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.ownerDriverWorkspace ? 'owner_driver' as const : 'driver' as const;
  const [companyName, setCompanyName] = useState('Driver Account');
  const [unreadCount, setUnreadCount] = useState(0);

  const actionRole = resolveActionCentreRole(role);
  const notificationsHref = getNotificationsRoute(actionRole);

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
      <aside className="global-rail" aria-label="XDrive workspace shortcuts">
        <button type="button" className="rail-logo" title="XDrive" onClick={() => router.push('/driver')}>XD</button>
        <button type="button" title="Dashboard" onClick={() => router.push('/driver')}>âŒ‚</button>
        <button type="button" title="Loads" onClick={() => router.push('/driver/loads')}>â†”</button>
        <button type="button" title="Diary" onClick={() => router.push('/driver/history')}>â–¤</button>
        <button type="button" title="Fleet" onClick={() => router.push('/driver/vehicles')}>â–¦</button>
        <span className="rail-spacer" />
        <button type="button" title="Settings" onClick={() => router.push('/driver/settings')}>âš™</button>
      </aside>
      <header className="topbar">
        <div className="brand">
          <button type="button" className="driver-prototype-brand-button" onClick={() => router.push('/driver')} aria-label="Open Driver dashboard">
            <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={160} height={44} priority />
          </button>
        </div>
        <button type="button" className="cta post" onClick={() => router.push('/driver/post-load')}>POST LOAD</button>
        <button type="button" className="cta direct" onClick={() => router.push('/driver/directory')}>BOOK DIRECT</button>
        <nav className="main-nav" aria-label="Driver workspace navigation">
          {DRIVER_PRIMARY_NAV.map((item) => {
            const active = isActive(item.href);
            return <button key={item.id} type="button" className={active ? 'active' : ''} onClick={() => router.push(item.href)} aria-current={active ? 'page' : undefined}>{item.label}</button>;
          })}
        </nav>
        <div className="top-tools">
          <button type="button" onClick={() => router.push('/driver/messages')}>Messages</button>
          <button type="button" onClick={() => router.push(notificationsHref)}>Alerts {unreadCount > 0 && <b className="notif">{unreadCount > 99 ? '99+' : unreadCount}</b>}</button>
          <button type="button" onClick={() => router.push('/driver/settings')}>Settings</button>
          <button type="button" className="avatar account-toggle" onClick={() => router.push('/driver/account')} aria-label="Open account">{(companyName || 'DR').slice(0, 2).toUpperCase()}</button>
        </div>
      </header>
      <main className="app driver-prototype-app" style={{ background: workspaceTheme.page }}>{children}</main>
    </div>
  );
}
