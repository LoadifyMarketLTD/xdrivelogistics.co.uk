'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Platform', href: '#modules' },
  { label: 'How it works', href: '#workflow' },
  { label: 'Pricing', href: '#launch' },
] as const;

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={[
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200',
          scrolled
            ? 'border-b border-[rgba(47,107,255,0.18)] bg-[rgba(7,11,20,0.93)] backdrop-blur-[14px] shadow-[0_1px_12px_rgba(0,0,0,0.45)]'
            : 'border-b border-transparent bg-transparent',
        ].join(' ')}
        style={{ height: 'var(--xd-nav-height)' }}
      >
        <div className="xd-container flex h-full items-center justify-between">
          {/* Logo */}
          <Link href="/" aria-label="XDrive Logistics home">
            <Image
              src="/xdrive-logo-horizontal.png"
              alt="XDrive Logistics"
              width={246}
              height={66}
              priority
              className="h-7 w-auto"
            />
          </Link>

          {/* Desktop nav links */}
          <nav aria-label="Main navigation" className="hidden items-center gap-8 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[length:var(--xd-body-s-size)] font-medium text-xd-text-ds transition-colors duration-xd-fast hover:text-xd-text-dp"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA + mobile hamburger */}
          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className="xd-btn xd-btn--primary hidden h-10 px-5 text-sm lg:inline-flex"
            >
              Request Access
            </Link>
            <button
              type="button"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              aria-controls="xd-mobile-nav"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-xd-text-dp lg:hidden"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile full-screen overlay */}
      <div
        id="xd-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!mobileOpen}
        className={[
          'fixed inset-0 z-40 flex flex-col bg-xd-bg-primary transition-opacity duration-200 lg:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        style={{ paddingTop: 'var(--xd-nav-height)' }}
      >
        <nav
          aria-label="Mobile navigation"
          className="flex flex-1 flex-col gap-8 px-[var(--xd-gutter-mobile)] py-10"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="text-2xl font-semibold text-xd-text-dp transition-colors hover:text-xd-blue"
              tabIndex={mobileOpen ? 0 : -1}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="px-[var(--xd-gutter-mobile)] py-8">
          <Link
            href="/register"
            onClick={() => setMobileOpen(false)}
            tabIndex={mobileOpen ? 0 : -1}
            className="xd-btn xd-btn--primary flex w-full items-center justify-center"
          >
            Request Access
          </Link>
        </div>
      </div>
    </>
  );
}
