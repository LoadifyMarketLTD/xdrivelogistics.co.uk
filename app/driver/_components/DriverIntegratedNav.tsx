'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type DriverIntegratedNavItem = {
  href: string;
  label: string;
};

export default function DriverIntegratedNav({ label, items }: { label: string; items: DriverIntegratedNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="driver-integrated-nav" aria-label={label}>
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/driver' && pathname.startsWith(item.href + '/'));
        return (
          <Link key={item.href} href={item.href} data-active={active ? 'true' : 'false'} aria-current={active ? 'page' : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
