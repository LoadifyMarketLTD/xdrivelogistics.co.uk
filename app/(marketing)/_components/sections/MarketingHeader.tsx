import Link from 'next/link';
import Image from 'next/image';

import { navLinks } from '../content';

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07111f]/92 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[78px] w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={246} height={66} priority className="h-[42px] w-auto sm:h-[48px]" />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 lg:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="transition hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-sm sm:gap-3">
          <Link href="/login" className="inline-flex items-center rounded-xl border border-white/15 px-4 py-2 font-semibold text-white transition hover:bg-white/10">
            Sign In
          </Link>
          <Link href="/register" className="inline-flex items-center rounded-xl bg-[#2563eb] px-4 py-2 font-semibold text-white transition hover:bg-[#1d4ed8]">
            Request Early Access
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 lg:hidden">
        <nav className="mx-auto flex w-full max-w-7xl gap-5 overflow-x-auto px-4 py-3 text-sm font-medium text-slate-300 sm:px-6">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="whitespace-nowrap transition hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
