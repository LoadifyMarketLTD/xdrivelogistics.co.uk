'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard, PackagePlus, Truck, Tags, CheckCircle2, ClipboardCheck,
  CalendarDays, ClipboardList, Menu, Network, ChevronsLeft, ChevronsRight,
} from 'lucide-react';

const sections = [
  { label: 'Dashboard', href: '/broker', Icon: LayoutDashboard },
  { label: 'Post Load', href: '/broker/post-load', Icon: PackagePlus },
  { label: 'My Loads', href: '/broker/loads', Icon: Truck },
  { label: 'Carrier Quotes', href: '/broker/bids', Icon: Tags },
  { label: 'Awards', href: '/broker/awards', Icon: CheckCircle2 },
  { label: 'Bookings', href: '/broker/jobs', Icon: ClipboardCheck },
  { label: 'Diary', href: '/broker/diary', Icon: CalendarDays },
  { label: 'POD Review', href: '/broker/pod-review', Icon: ClipboardList },
  { label: 'More', href: '/broker/finance', Icon: Menu },
  { label: 'Network & Tools', href: '/broker/carrier-network', Icon: Network },
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
  const [collapsed, setCollapsed] = useState(false);
  const active = (href: string) => href === '/broker'
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/');
  const moreActive = more.some((item) => item.href !== '/broker/carrier-network' && active(item.href)) || active('/broker/finance');
  const isActive = (label: string, href: string) => label === 'More' ? moreActive : active(href);

  return (
    <div className={'broker3118-app broker3150-visual' + (collapsed ? ' broker3150-collapsed' : '')}>
      <aside className="broker3118-sidebar" aria-label="Broker workspace navigation">
        <Link href="/broker" className="broker3118-brand" aria-label="XDrive Logistics — Broker dashboard">
          <span className="broker3118-brand-text">XDRIVE <em>LOGISTICS</em></span>
        </Link>
        <nav className="broker3118-links" aria-label="Broker sections">
          {sections.map(({ label, href, Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              aria-current={isActive(label, href) ? 'page' : undefined}
              className={'broker3118-link' + (isActive(label, href) ? ' active' : '')}
            >
              <Icon className="broker3118-icon" size={19} strokeWidth={2.3} aria-hidden="true" />
              <span className="broker3118-label">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="broker3150-sidebar-footer">
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(value => !value)}
          >
            {collapsed ? <ChevronsRight size={21} /> : <ChevronsLeft size={21} />}
          </button>
        </div>
      </aside>
      <div className="broker3118-main">
        <nav className="broker3118-mobile" aria-label="Broker mobile navigation">
          {sections.map(({ label, href }) => (
            <Link key={href} href={href} className={isActive(label, href) ? 'active' : ''}>{label}</Link>
          ))}
        </nav>
        <div className="broker3118-content">{children}</div>
        {moreActive && (
          <nav className="broker3118-tools" aria-label="Broker management tools">
            {more.map((item) => (
              <Link key={item.href} href={item.href} className={active(item.href) ? 'active' : ''}>{item.label}</Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
