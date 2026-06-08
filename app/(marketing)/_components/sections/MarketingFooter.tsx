import Link from 'next/link';
import Image from 'next/image';

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

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75" />
    </svg>
  );
}

export function MarketingFooter() {
  return (
    <footer id="contact" className="bg-slate-900 px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto grid max-w-[1200px] gap-6 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        {/* Brand column */}
        <div>
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/xdrive-logo.jpeg"
              alt="XDrive Logistics"
              width={266}
              height={62}
              className="h-[62px] w-auto drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]"
            />
          </Link>
          <p className="mt-4 max-w-[240px] text-sm leading-relaxed text-slate-400">
            MVP / early-access logistics platform for approved UK users across marketplace, operations, POD and finance records.
          </p>
          <div className="mt-5 flex gap-3 text-slate-400">
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="transition hover:text-white">
              <LinkedInIcon />
            </a>
            <a href="mailto:hello@xdrivelogistics.co.uk" aria-label="Email" className="transition hover:text-white">
              <EnvelopeIcon />
            </a>
          </div>
        </div>

        {/* Platform */}
        <div>
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
        <div>
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
        <div>
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

      <div className="mx-auto mt-8 max-w-[1200px] border-t border-slate-700 pt-6 text-xs text-slate-500">
        XDrive Logistics Ltd &bull; Company No. 13171804 &bull; Founded 1 February 2021 &bull; &copy; 2026 XDrive Logistics Ltd &bull; All Rights Reserved
      </div>
    </footer>
  );
}
