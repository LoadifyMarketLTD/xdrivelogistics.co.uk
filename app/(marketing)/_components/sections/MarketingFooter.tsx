import Link from 'next/link';
import Image from 'next/image';
import { COMPANY_CONFIG } from '../../../config/company';

const footerColumns = {
  platform: [
    { label: 'Marketplace', href: '#platform' },
    { label: 'Operations', href: '#platform' },
    { label: 'Fleet', href: '#platform' },
    { label: 'Drivers', href: '#platform' },
    { label: 'Finance', href: '#platform' },
  ],
  solutions: [
    { label: 'Transport Customers', href: '#solutions' },
    { label: 'Courier Companies', href: '#solutions' },
    { label: 'Owner Operators', href: '#solutions' },
    { label: 'Drivers', href: '#solutions' },
  ],
  company: [
    { label: 'About', href: '#resources' },
    { label: 'Launch', href: '#launch' },
    { label: 'Contact', href: '#contact' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Cookies', href: '/cookies' },
    { label: 'GDPR', href: '/privacy#gdpr' },
  ],
} as const;

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M22 12.061C22 6.505 17.523 2 12 2S2 6.505 2 12.061C2 17.083 5.657 21.245 10.438 22v-7.03H7.898v-2.909h2.54V9.845c0-2.522 1.493-3.915 3.777-3.915 1.094 0 2.238.196 2.238.196v2.475h-1.261c-1.243 0-1.63.776-1.63 1.572v1.888h2.773l-.443 2.909h-2.33V22C18.343 21.245 22 17.083 22 12.061Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M16.78 2c.35 2.8 1.92 4.47 4.72 4.65v3.15a7.94 7.94 0 0 1-4.6-1.42v6.58c0 4.37-2.88 7.04-6.77 7.04-3.43 0-6.13-2.32-6.13-5.74 0-3.72 2.98-5.9 6.57-5.9.45 0 .89.04 1.32.13v3.34a4.5 4.5 0 0 0-1.4-.22c-1.72 0-3.13.93-3.13 2.56 0 1.5 1.18 2.47 2.65 2.47 1.72 0 2.95-1.07 2.95-3.35V2h3.82Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M21.58 7.19a2.74 2.74 0 0 0-1.93-1.94C17.95 4.8 12 4.8 12 4.8s-5.95 0-7.65.45a2.74 2.74 0 0 0-1.93 1.94A28.6 28.6 0 0 0 2 12a28.6 28.6 0 0 0 .42 4.81 2.74 2.74 0 0 0 1.93 1.94c1.7.45 7.65.45 7.65.45s5.95 0 7.65-.45a2.74 2.74 0 0 0 1.93-1.94A28.6 28.6 0 0 0 22 12a28.6 28.6 0 0 0-.42-4.81ZM10 15.21V8.79L15.45 12 10 15.21Z" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75" />
    </svg>
  );
}

const socialLinks = [
  { label: 'Facebook', href: COMPANY_CONFIG.social.facebook, icon: FacebookIcon },
  { label: 'Instagram', href: COMPANY_CONFIG.social.instagram, icon: InstagramIcon },
  { label: 'TikTok', href: COMPANY_CONFIG.social.tiktok, icon: TikTokIcon },
  { label: 'YouTube', href: COMPANY_CONFIG.social.youtube, icon: YouTubeIcon },
  { label: 'LinkedIn', href: COMPANY_CONFIG.social.linkedin, icon: LinkedInIcon },
] as const;

export function MarketingFooter() {
  return (
    <footer id="contact" className="bg-slate-900 px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto grid max-w-[1200px] gap-6 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        {/* Brand column */}
        <div className="hidden sm:block">
          <Link href="/" className="inline-flex items-center rounded-lg bg-white px-3 py-2 shadow-lg shadow-slate-950/20">
            <Image
              src="/xdrive-logo-horizontal.png"
              alt="XDrive Logistics"
              width={280}
              height={75}
              className="h-[58px] w-auto sm:h-[70px]"
            />
          </Link>
          <p className="mt-4 max-w-[240px] text-sm leading-relaxed text-slate-400">
            Functional early-access logistics platform for approved UK users across marketplace, operations, POD and finance records.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-slate-400">
            {socialLinks.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target={href === '#' ? undefined : '_blank'}
                rel={href === '#' ? undefined : 'noopener noreferrer'}
                aria-label={label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                <Icon />
              </a>
            ))}
            <a href={`mailto:${COMPANY_CONFIG.email}`} aria-label="Email" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:border-white/25 hover:bg-white/10 hover:text-white">
              <EnvelopeIcon />
            </a>
          </div>
        </div>

        {/* Platform */}
        <div className="hidden sm:block">
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Platform</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            {footerColumns.platform.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Solutions */}
        <div className="hidden sm:block">
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Solutions</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            {footerColumns.solutions.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div className="hidden sm:block">
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Company</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            {footerColumns.company.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Legal</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            {footerColumns.legal.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-[1200px] border-t border-slate-700 pt-6 text-xs leading-5 text-slate-500">
        XDrive Logistics Ltd &bull; Company No. 13171804 &bull; Founded 1 February 2021 &bull; &copy; 2026 XDrive Logistics Ltd &bull; All Rights Reserved
      </div>
    </footer>
  );
}
