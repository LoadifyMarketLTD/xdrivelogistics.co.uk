'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const sections = [
  { label: 'Dashboard', href: '/broker', icon: '▦' },
  { label: 'Post Load', href: '/broker/post-load', icon: '+' },
  { label: 'My Loads', href: '/broker/loads', icon: '↗' },
  { label: 'Carrier Quotes', href: '/broker/bids', icon: '£' },
  { label: 'Awards', href: '/broker/awards', icon: '✓' },
  { label: 'Bookings', href: '/broker/jobs', icon: '▤' },
  { label: 'Diary', href: '/broker/diary', icon: '◷' },
  { label: 'POD Review', href: '/broker/pod-review', icon: '▣' },
  { label: 'More', href: '/broker/finance', icon: '☰' },
  { label: 'Network & Tools', href: '/broker/carrier-network', icon: '◎' },
] as const;

const more = [
  { label: 'Customer Accounts', href: '/broker/customers' },
  { label: 'Carrier Network', href: '/broker/carrier-network' },
  { label: 'Messages', href: '/broker/messages' },
  { label: 'Customer Invoices', href: '/broker/customer-invoices' },
  { label: 'Carrier Costs', href: '/broker/carrier-costs' },
  { label: 'Margins & Reports', href: '/broker/margins' },
  { label: 'Event Log', href: '/broker/event-log' },
  { label: 'Help & Support', href: '/broker/support' },
] as const;

export default function Broker3118Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/broker';
  const active = (href: string) => href === '/broker' ? pathname === href : pathname === href || pathname.startsWith(href + '/');
  const moreActive = more.some((item) => active(item.href)) || active('/broker/finance');
  return (
    <div className="broker3118-app">
      <aside className="broker3118-sidebar" aria-label="Broker 3118 navigation">
        <Link href="/broker" className="broker3118-brand">XDRIVE <em>LOGISTICS</em></Link>
        <div className="broker3118-caption">BROKER WORKSPACE</div>
        <nav className="broker3118-links">
          {sections.map((item) => (
            <Link key={item.href} href={item.href} aria-current={(item.label === 'More' ? moreActive : active(item.href)) ? 'page' : undefined}
              className={'broker3118-link' + ((item.label === 'More' ? moreActive : active(item.href)) ? ' active' : '')}>
              <span className="broker3118-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="broker3118-sidefooter">Move Freight. Manage Operations.</div>
      </aside>
      <div className="broker3118-main">
        <nav className="broker3118-mobile" aria-label="Broker mobile navigation">
          {sections.map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? 'active' : ''}>{item.label}</Link>)}
        </nav>
        <div className="broker3118-content">{children}</div>
        {moreActive && <nav className="broker3118-tools" aria-label="Broker management tools">
          {more.map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? 'active' : ''}>{item.label}</Link>)}
        </nav>}
      </div>
    </div>
  );
}
