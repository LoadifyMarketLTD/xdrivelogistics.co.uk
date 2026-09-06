'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ChevronDown,
  CircleUserRound,
  Grid3X3,
  LayoutDashboard,
  Search,
  Truck,
} from 'lucide-react';

import { useAuth } from '../../components/AuthContext';
import type { WorkspaceShellFixtureOverrides } from '../../components/workspace/WorkspaceShell';
import type { WorkspaceDefinition } from '../../../lib/workspaceRole';

export default function SuperAdminNavbar({
  definition,
  fixtureOverrides,
}: {
  definition: WorkspaceDefinition;
  fixtureOverrides?: WorkspaceShellFixtureOverrides;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [searchValue, setSearchValue] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);

  const navigationTargets = useMemo(
    () => definition.nav.flatMap((group) => group.items.map((item) => ({
      label: item.label,
      group: group.label,
      href: item.href,
    }))),
    [definition.nav],
  );

  const email = user?.email
    ?? (fixtureOverrides?.companyName?.includes('@') ? fixtureOverrides.companyName : null)
    ?? 'xdrivelogisticsltd@gmail.com';

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchValue.trim();
    if (!query) return;

    const normalized = query.toLowerCase();
    const target = navigationTargets.find((item) => item.label.toLowerCase() === normalized)
      ?? navigationTargets.find((item) => item.label.toLowerCase().includes(normalized))
      ?? navigationTargets.find((item) => item.group.toLowerCase().includes(normalized));

    if (target) {
      router.push(target.href);
      setSearchValue('');
      return;
    }

    router.push(`/super-admin/search?q=${encodeURIComponent(query)}`);
  };

  useEffect(() => {
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <nav className="sa-navbar" aria-label="Super Admin enterprise navigation">
      <Link className="sa-brand" href="/super-admin" aria-label="XDrive Logistics Super Admin home">
        <Truck size={24} aria-hidden="true" />
        <span className="sa-brand-title">XDrive Logistics</span>
      </Link>

      <form className="sa-search" role="search" onSubmit={submitSearch}>
        <Search size={24} aria-hidden="true" />
        <input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search platform..."
          aria-label="Search platform"
          autoComplete="off"
        />
      </form>

      <div className="sa-primary-actions" aria-label="Primary Super Admin navigation">
        <Link className="sa-primary-button" href="/super-admin/directory">
          <Grid3X3 size={24} aria-hidden="true" />
          <span>Explore areas</span>
        </Link>
        <Link className="sa-primary-button" href="/super-admin/action-centre">
          <AlertTriangle size={24} aria-hidden="true" />
          <span>Action Centre</span>
        </Link>
        <Link className="sa-primary-button" href="/super-admin/platform">
          <LayoutDashboard size={24} aria-hidden="true" />
          <span>Platform Overview</span>
        </Link>
      </div>

      <div className="sa-user-wrap">
        <button
          type="button"
          className="sa-user-button"
          onClick={() => setAccountOpen((open) => !open)}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
        >
          <CircleUserRound size={24} aria-hidden="true" />
          <span>Platform Owner</span>
          <ChevronDown size={24} aria-hidden="true" />
        </button>

        {accountOpen ? (
          <div className="sa-user-menu" role="menu" aria-label="Platform Owner">
            <div className="sa-user-menu-header">
              <strong>Platform Owner</strong>
              <span>{email}</span>
            </div>
            <Link role="menuitem" href="/super-admin">Super Admin home</Link>
            <Link role="menuitem" href="/super-admin/directory">Explore all areas</Link>
            <Link role="menuitem" href="/auth/sign-out">Sign out</Link>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
