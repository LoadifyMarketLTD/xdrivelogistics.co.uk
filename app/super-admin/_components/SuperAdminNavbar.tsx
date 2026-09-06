'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle as ActionIcon,
  ChevronDown,
  CircleUserRound,
  Grid3X3 as ExploreIcon,
  LayoutDashboard as OverviewIcon,
  Search,
} from 'lucide-react';

type NavButtonProps = {
  icon: ReactNode;
  label: string;
  href: string;
};

function NavButton({ icon, label, href }: NavButtonProps) {
  return (
    <Link className="sa-primary-button" href={href}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function SearchBar({ placeholder, iconSize }: { placeholder: string; iconSize: number }) {
  const router = useRouter();
  const [value, setValue] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    router.push(`/super-admin/search?q=${encodeURIComponent(query)}`);
    setValue('');
  };

  return (
    <form className="sa-search" role="search" onSubmit={submit}>
      <Search size={iconSize} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label="Search platform"
        autoComplete="off"
      />
    </form>
  );
}

type UserDropdownOption = {
  label: string;
  href: string;
};

function UserDropdown({
  user,
  email,
  options,
}: {
  user: string;
  email: string;
  options: UserDropdownOption[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="sa-user-wrap">
      <button
        type="button"
        className="sa-user-button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <CircleUserRound size={24} aria-hidden="true" />
        <span>{user}</span>
        <ChevronDown size={24} aria-hidden="true" />
      </button>

      {open ? (
        <div className="sa-user-menu" aria-label={user}>
          <div className="sa-user-menu-header">
            <strong>{user}</strong>
            <span>{email}</span>
          </div>
          {options.map((option) => (
            <Link key={option.href} href={option.href}>{option.label}</Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SuperAdminNavbar() {
  return (
    <nav className="sa-navbar" aria-label="Super Admin enterprise navigation">
      <div className="sa-brand">
        <Image
          src="/icon-192.png"
          alt=""
          width={24}
          height={24}
          className="sa-brand-mark"
          priority
        />
        <span className="sa-brand-title">XDrive Logistics</span>
      </div>

      <SearchBar placeholder="Search platform..." iconSize={24} />

      <div className="sa-primary-actions" aria-label="Primary Super Admin navigation">
        <NavButton icon={<ExploreIcon size={24} />} label="Explore areas" href="/super-admin/directory" />
        <NavButton icon={<ActionIcon size={24} />} label="Action Centre" href="/super-admin/action-centre" />
        <NavButton icon={<OverviewIcon size={24} />} label="Platform Overview" href="/super-admin/platform" />
      </div>

      <UserDropdown
        user="Platform Owner"
        email="xdrivelogisticsltd@gmail.com"
        options={[
          { label: 'Super Admin home', href: '/super-admin' },
          { label: 'Explore all areas', href: '/super-admin/directory' },
          { label: 'Sign out', href: '/auth/sign-out' },
        ]}
      />
    </nav>
  );
}
