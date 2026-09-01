import Link from 'next/link';
import { COMPANY_CONFIG } from '../../config/company';

export function LegalDisclosureBar() {
  return (
    <section className="border-t border-[#E2E8F1] bg-[#F8FAFD] px-5 py-7 sm:px-8">
      <div className="mx-auto grid max-w-[1240px] gap-5 text-xs font-bold leading-5 text-[#60758F] lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div>
          <p className="font-black text-[#0A234F]">{COMPANY_CONFIG.legalName}</p>
          <p>Company No. {COMPANY_CONFIG.companyNumber} · Registered in England and Wales</p>
          <p>Registered office: {COMPANY_CONFIG.address.street}, {COMPANY_CONFIG.address.city}, England, {COMPANY_CONFIG.address.postcode}</p>
          <p>VAT registration: {COMPANY_CONFIG.vat.registrationNumber}</p>
          <p className="mt-2">XDrive operates the platform as an intermediary unless it expressly contracts to provide a transport service itself. No client funds are held by XDrive under the current platform model.</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 font-black text-[#0E3FA9]">
          <Link href="/terms">Terms</Link>
          <Link href="/subscription-terms">Subscription Terms</Link>
          <Link href="/acceptable-use">Acceptable Use</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/complaints">Complaints</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
    </section>
  );
}
