'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Jobs', href: '/m/driver/jobs' },
  { label: 'Quotes', href: '/m/driver/quotes' },
  { label: 'Bookings', href: '/m/driver/bookings' },
  { label: 'More', href: '/m/driver/more' },
] as const;

export default function DriverMobileNavigation() {
  const pathname = usePathname();
  return <nav className="xd-driver-mobile__nav" aria-label="Driver navigation">
    {tabs.map(({label,href}) => <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(href + '/') ? 'page' : undefined}>{label}</Link>)}
  </nav>;
}
