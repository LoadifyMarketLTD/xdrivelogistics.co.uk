'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const tabs = [
  { label: 'Jobs', href: '/m/driver/jobs' },
  { label: 'Quotes', href: '/m/driver/quotes' },
  { label: 'Bookings', href: '/m/driver/bookings' },
  { label: 'More', href: '/m/driver/more' },
] as const;

const moreSubviews = ['/m/driver/documents', '/m/driver/messages', '/m/driver/settings', '/m/driver/availability', '/m/driver/return-journeys', '/m/driver/support', '/m/driver/finance'];

export default function DriverMobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  // Preload the four lightweight route payloads before the first tap.
  useEffect(() => { for (const tab of tabs) router.prefetch(tab.href); }, [router]);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Committed route always overrides the temporary touch feedback.
  useEffect(() => { setPendingHref(null); }, [pathname]);

  const isMoreSubview = moreSubviews.some(path => pathname === path || pathname.startsWith(path + '/'));
  return <nav className="xd-driver-mobile__nav" aria-label="Driver navigation">
    {tabs.map(({ label, href }) => {
      const active = pathname === href || pathname.startsWith(href + '/') || (href === '/m/driver/more' && isMoreSubview);
      const pending = pendingHref === href && !active;
      return <Link key={href} href={href} prefetch
        aria-current={active ? 'page' : undefined}
        data-pending={pending ? 'true' : undefined}
        onPointerDown={() => { if (!active) setPendingHref(href); }}
        onClick={() => { if (!active) setPendingHref(href); }}>
        {label}{pending ? <span className="xd-driver-mobile__nav-pending" aria-hidden="true" /> : null}
      </Link>;
    })}
  </nav>;
}
