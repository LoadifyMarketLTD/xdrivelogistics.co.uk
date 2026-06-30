import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

const contactLinks = {
  email: 'xdrivelogisticsltd@gmail.com',
  phoneDisplay: '+44 7423 272138',
  phoneHref: 'tel:+447423272138',
  whatsapp: 'https://wa.me/447423272138',
  facebook: 'https://www.facebook.com/share/14oVGis6nKe/',
  messenger: 'https://www.facebook.com/messages/t/xdrivelogistics/',
  instagram: 'https://www.instagram.com/xdrivelogistics/',
  tiktok: 'https://www.tiktok.com/@xdrivelogistics',
  maps: 'https://www.google.com/maps/search/?api=1&query=101%20Cornelian%20Street%2C%20Blackburn%2C%20BB1%209QL%2C%20United%20Kingdom',
} as const;

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
    <footer id="contact" className="bg-slate-900 px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto mb-10 grid max-w-[1200px] gap-5 border-b border-slate-700 pb-9 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase text-amber-400">Contact XDrive</p>
          <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Speak with our logistics team</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Questions about transport, early access or your XDrive account? Contact our Blackburn team directly.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={contactLinks.phoneHref} className="inline-flex min-h-11 items-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 transition hover:border-amber-400 hover:text-white">
            <Phone className="h-4 w-4 text-amber-400" aria-hidden="true" />
            {contactLinks.phoneDisplay}
          </a>
          <a href={`mailto:${contactLinks.email}`} className="inline-flex min-h-11 items-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 transition hover:border-amber-400 hover:text-white">
            <Mail className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span className="break-all">{contactLinks.email}</span>
          </a>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-6 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
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
          <a
            href={contactLinks.maps}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex max-w-[280px] items-start gap-2 text-sm leading-relaxed text-slate-400 transition hover:text-white"
          >
            <MapPin className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span>101 Cornelian Street, Blackburn, BB1 9QL, United Kingdom</span>
          </a>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
            <a href={contactLinks.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-white">
              Facebook <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a href={contactLinks.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-white">
              Instagram <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a href={contactLinks.tiktok} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-white">
              TikTok <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a href={contactLinks.messenger} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-white">
              Messenger <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a href={contactLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-white">
              WhatsApp <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

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

      <div className="mx-auto mt-8 max-w-[1200px] border-t border-slate-700 pt-6 text-xs text-slate-500">
        XDrive Logistics Ltd &bull; Company No. 13171804 &bull; Founded 1 February 2021 &bull; &copy; 2026 XDrive Logistics Ltd &bull; All Rights Reserved
      </div>
    </footer>
  );
}
