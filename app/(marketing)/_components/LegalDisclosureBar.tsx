import Link from 'next/link';
import { COMPANY_CONFIG } from '../../config/company';

const groups = [
  {
    title: 'Platform',
    links: [
      ['Platform', '/platform'],
      ['Exchange', '/exchange'],
      ['How It Works', '/how-it-works'],
      ['Customers', '/customers'],
      ['Brokers', '/brokers'],
      ['Couriers', '/couriers'],
    ],
  },
  {
    title: 'Product',
    links: [
      ['Operations Diary', '/operations-diary'],
      ['Courier Workspace', '/courier-workspace'],
      ['POD & Records', '/pod-records'],
      ['Finance', '/finance'],
    ],
  },
  {
    title: 'Membership & Help',
    links: [
      ['Pricing', '/pricing'],
      ['Access', '/access'],
      ['Request Access', '/register'],
      ['Sign In', '/login'],
      ['Help & FAQ', '/help'],
      ['Contact', '/contact'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['Terms', '/terms'],
      ['Subscription Terms', '/subscription-terms'],
      ['Acceptable Use', '/acceptable-use'],
      ['Privacy', '/privacy'],
      ['Cookies', '/cookies'],
      ['Complaints', '/complaints'],
    ],
  },
] as const;

export function LegalDisclosureBar() {
  return (
    <section className="border-t border-[#E2E8F1] bg-[#F8FAFD] px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-9 lg:grid-cols-[1.2fr_2fr] lg:items-start">
          <div className="text-xs font-bold leading-5 text-[#60758F]">
            <p className="font-black text-[#0A234F]">{COMPANY_CONFIG.legalName}</p>
            <p>Company No. {COMPANY_CONFIG.companyNumber} · Registered in England and Wales</p>
            <p>Registered office: {COMPANY_CONFIG.address.street}, {COMPANY_CONFIG.address.city}, England, {COMPANY_CONFIG.address.postcode}</p>
            <p>VAT registration: {COMPANY_CONFIG.vat.registrationNumber}</p>
            <p className="mt-3">XDrive operates the platform as an intermediary unless it expressly contracts to provide a transport service itself. No client funds are held by XDrive under the current platform model.</p>
          </div>

          <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-4">
            {groups.map(group => (
              <div key={group.title}>
                <h2 className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#F5A300]">{group.title}</h2>
                <div className="mt-4 grid gap-2.5 text-xs font-black text-[#0E3FA9]">
                  {group.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
