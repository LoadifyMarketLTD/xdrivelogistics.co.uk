'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ACCOUNT_SECTIONS = [
  { label: 'Profile', href: '/driver/profile' },
  { label: 'Vehicle', href: '/driver/vehicles' },
  { label: 'Documents', href: '/driver/documents' },
  { label: 'Finance', href: '/driver/finance' },
  { label: 'Messages', href: '/driver/messages' },
  { label: 'Notifications', href: '/driver/notifications' },
  { label: 'Load Alerts', href: '/driver/load-alerts' },
  { label: 'Security', href: '/driver/change-password' },
  { label: 'Event Log', href: '/driver/event-log' },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/driver/profile' && pathname === '/driver/account') return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AccountSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="driver-account-section-nav" aria-label="Account sections">
      <div className="driver-account-section-nav__head">Account</div>
      <div className="driver-account-section-nav__body">
        {ACCOUNT_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="driver-account-section-nav__link"
            data-active={isActive(pathname, section.href) ? 'true' : 'false'}
            aria-current={isActive(pathname, section.href) ? 'page' : undefined}
          >
            {section.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
