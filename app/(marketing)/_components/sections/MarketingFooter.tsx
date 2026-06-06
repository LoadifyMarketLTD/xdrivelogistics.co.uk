import Link from 'next/link';

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

export function MarketingFooter() {
  return (
    <footer id="contact" className="bg-slate-900 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-[1200px] gap-8 md:grid-cols-4">
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

      <div className="mx-auto mt-12 border-t border-slate-700 pt-6 text-xs text-slate-500">
        <span>XDrive Logistics Ltd · Company No. 13171804 · Founded 1 February 2021 · © 2026 XDrive Logistics Ltd</span>
      </div>
    </footer>
  );
}
