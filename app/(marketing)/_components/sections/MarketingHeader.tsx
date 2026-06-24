import Link from 'next/link';
import Image from 'next/image';
import { LogIn, ShieldCheck } from 'lucide-react';

import { navLinks } from '../content';

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 h-[76px] border-b border-slate-200 bg-white/95 backdrop-blur-md sm:h-[84px] xl:h-[88px]">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={246} height={66} priority className="h-[46px] w-auto sm:h-[54px] lg:h-[56px] xl:h-[64px]" />
        </Link>

        <nav className="hidden items-center gap-4 text-xs font-medium text-slate-600 lg:flex xl:gap-6 xl:text-sm">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="transition hover:text-[#1d4ed8]">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-sm sm:gap-3">
          <Link href="/login" className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-3">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Log In</span>
          </Link>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#1d4ed8] px-3 py-2.5 font-semibold text-white transition hover:bg-[#1e40af] sm:px-4">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Join</span>
            <span className="hidden sm:inline">Early Access</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
