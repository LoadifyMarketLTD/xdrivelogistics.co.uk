'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '../../components/workspace/role-settings-workspace.css';
import '../xdrive-owner-settings-v9.css';

const categories = [
  { label: 'My Profile', href: '/driver/settings?section=overview', slug: 'profile' },
  { label: 'Company Settings', href: '/driver/settings?section=company', slug: 'company' },
  { label: 'Operations', href: '/driver/settings?section=operations', slug: 'operations' },
  { label: 'Security', href: '/driver/settings?section=security', slug: 'security' },
  { label: 'Billing & Membership', href: '/driver/settings/billing', slug: 'billing' },
  { label: 'Legal & Agreements', href: '/driver/account/legal-agreements', slug: 'legal' },
] as const;

/** Identical account navigation on Legal and Billing subroutes; operational sections stay in More. */
export default function OwnerDriverSettingsSectionShell({
  active, children,
}: { active: 'legal' | 'billing'; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="role-settings-layout owner-settings-route-layout" data-owner-settings="true">
      <aside className="role-settings-nav" aria-label="Owner Driver account settings">
        <div className="role-settings-company">
          <strong>Account settings</strong>
          <span>Owner Driver</span>
        </div>
        {categories.map((item) => (
          <Link key={item.slug} href={item.href}
            data-active={active === item.slug && pathname !== '/driver/settings' ? 'true' : 'false'}
            aria-current={active === item.slug ? 'page' : undefined}>
            {item.label}
          </Link>
        ))}
      </aside>
      <main className="role-settings-main">{children}</main>
    </div>
  );
}
