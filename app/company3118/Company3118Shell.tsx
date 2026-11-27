'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ApprovedSidebar from './components/ApprovedSidebar';
import MasterLogoutButton from '../try-xdrive-demo/components/MasterLogoutButton';
import Link from 'next/link';
import './xdrive-design-system.css';
import './demo.css';
import './wide-layout.css';
import './components/operations-demo.css';
import './components/company-sidebar-compact.css';
import './components/company-layout-stability.css';

const navigation = [
  ['Dashboard', '/admin'],
  ['Post Load', '/admin/post-load'],
  ['Loads', '/admin/marketplace'],
  ['Quotes', '/admin/exchange'],
  ['Bookings', '/admin/won-work'],
  ['My Fleet', '/admin/fleet'],
  ['Drivers', '/admin/drivers'],
  ['Diary', '/admin/diary'],
  ['Invoices', '/admin/invoices'],
  ['Network & Tools', '/admin/network-tools'],
  ['Directory', '/admin/marketplace/directory'],
  ['Live Availability', '/admin/live-availability'],
  ['Return Journeys', '/admin/fleet/returns'],
  ['Freight Vision', '/admin/freight-vision'],
  ['Messages', '/admin/messages'],
  ['Notifications', '/admin/notifications'],
  ['Reports', '/admin/finance/reports'],
] as const;

// Visual chrome transplanted from 3118; navigation targets the existing authenticated
// commercial routes, never the /api/try-xdrive-demo write endpoints.
export default function Company3118Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const active = useMemo(() => {
    // Received quotes use separate authenticated routes from submitted quotes.
    if (pathname === '/admin/bids' || pathname === '/admin/exchange-quotes') {
      return navigation.findIndex(([label]) => label === 'Quotes');
    }
    const exact = navigation.findIndex(([, url]) => pathname === url);
    if (exact >= 0) return exact;
    const matches = navigation.map(([, url], index) => ({ index, url }))
      .filter(({ url }) => url !== '/admin' && pathname.startsWith(url + '/'))
      .sort((a,b) => b.url.length - a.url.length);
    return matches.length ? matches[0].index : -1;
  }, [pathname]);

  return (
    <main className="demo-shell ops-demo xd-approved-sidebar-shell" data-company-workspace="3118">
      <ApprovedSidebar items={navigation.map(([label]) => label)} activeIndex={active}
        onSelect={(index) => router.push(navigation[index][1])} />
      <div className="content">
        <header className="topbar">
          <div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div>
          <div className="top-actions"><Link href="/admin/settings">Settings</Link><Link href="/admin/notifications">Notifications</Link><MasterLogoutButton /></div>
        </header>
        <nav className="mobile-tabs" aria-label="Company workspace navigation">
          {navigation.map(([label,url],index) =>
            <button type="button" key={url} className={active === index ? 'active' : ''}
              onClick={() => router.push(url)}>{label}</button>)}
          <button type="button" className={pathname.startsWith('/admin/settings') ? 'active' : ''}
            onClick={() => router.push('/admin/settings')}>Settings</button>
        </nav>
        <div className="page">{children}</div>
      </div>
    </main>
  );
}
