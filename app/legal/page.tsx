import Link from 'next/link';
import { COMPANY_CONFIG } from '../config/company';

const LEGAL_GROUPS = [
  {
    title: 'Platform & membership',
    description: 'Core rules for using XDrive and for paid platform membership.',
    links: [
      { href: '/terms', label: 'XDrive Platform Terms' },
      { href: '/subscription-terms', label: 'Membership & Subscription Terms' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/complaints', label: 'Complaints Procedure' },
    ],
  },
  {
    title: 'Marketplace & transport',
    description: 'Commercial rules that apply when transport work is posted, quoted, awarded and completed through XDrive.',
    links: [
      { href: '/terms#marketplace-transport', label: 'Marketplace & Transport Trading Terms' },
    ],
  },
] as const;

export const metadata = {
  title: 'Legal Centre | XDrive Logistics',
  description: 'XDrive Logistics legal, membership, privacy and marketplace terms.',
};

export default function LegalCentrePage() {
  return (
    <main className="min-h-screen bg-[#071B3C] px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Legal centre</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">XDrive agreements and policies</h1>
        <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-white/65">
          Read the documents that govern platform access, membership, marketplace activity, transport operations and the processing of account information.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {LEGAL_GROUPS.map((group) => (
            <section key={group.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-black">{group.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/55">{group.description}</p>
              <div className="mt-5 space-y-2">
                {group.links.map((item) => (
                  <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-black transition hover:border-[#F5A300]/60 hover:bg-white/[0.06]">
                    <span>{item.label}</span>
                    <span aria-hidden="true" className="text-[#F5A300]">→</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-[#F5A300]/40 bg-[#F5A300]/10 p-6">
          <h2 className="text-lg font-black">Role-specific contractual acceptance</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/65">
            During registration and onboarding, XDrive presents the agreements and declarations that apply to the selected account role: Customer / Shipper, Transport Broker, Owner Driver or Carrier / Fleet. Material future changes may require renewed acceptance.
          </p>
        </section>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs font-semibold leading-6 text-white/45">
          <p>{COMPANY_CONFIG.legalName} · Company No. {COMPANY_CONFIG.companyNumber}</p>
          <p className="mt-1">{COMPANY_CONFIG.address.full}</p>
        </div>
      </div>
    </main>
  );
}
