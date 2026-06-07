import Link from 'next/link';
import Image from 'next/image';

import { navLinks } from '../content';

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 h-[80px] border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image src="/xdrive-logo.jpeg" alt="XDrive Logistics" width={250} height={60} priority className="h-[60px] w-auto" />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-slate-600 lg:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="transition hover:text-[#1d4ed8]">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100">
            Log In
          </Link>
          <Link href="/register" className="rounded-lg bg-[#1d4ed8] px-4 py-2.5 font-semibold text-white transition hover:bg-[#1e40af]">
            Join Early Access
          </Link>
        </div>
      </div>
    </header>
  );
}
